import { describe, expect, test } from 'bun:test';
import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import type { ConfigLoader } from '../../src/config-loader';
import { SET_AGENT_NAME_EVENT_ID } from '../../src/constants';
import { registerCustomFooter } from '../../src/extensions/custom-footer';
import type { CustomFooterComponent } from '../../src/extensions/custom-footer/footer-component';

 type Handler = (...args: any[]) => any;

function harness() {
  const handlers = new Map<string, Handler[]>();
  const eventHandlers = new Map<string, Handler>();
  const pi = {
    on: (name: string, handler: Handler) => handlers.set(name, [...(handlers.get(name) ?? []), handler]),
    events: { on: (name: string, handler: Handler) => eventHandlers.set(name, handler) },
    getThinkingLevel: () => 'off',
  } as unknown as ExtensionAPI;
  let defaultAgentName = 'DEFAULT';
  const config = {
    isEnabled: () => true,
    getCustomFooter: () => ({ defaultAgentName }),
  } as unknown as ConfigLoader;
  registerCustomFooter(pi, { config });
  return { handlers, eventHandlers, setDefaultAgentName: (name: string) => (defaultAgentName = name) };
}

function startSession(app: ReturnType<typeof harness>) {
  let factory: ((...args: any[]) => CustomFooterComponent) | undefined;
  const ctx = { ui: { setFooter: (value: typeof factory) => (factory = value) } };
  app.handlers.get('session_start')?.[0]?.({}, ctx);
  return { ctx, getFactory: () => factory };
}

function createComponent(factory: (...args: any[]) => CustomFooterComponent) {
  let renders = 0;
  let branchListener: (() => void) | undefined;
  let branchUnsubscribed = false;
  const component = factory(
    { requestRender: () => renders++ },
    { fg: (_color: string, text: string) => text },
    {
      getGitBranch: () => null,
      getExtensionStatuses: () => new Map(),
      getAvailableProviderCount: () => 1,
      onBranchChange: (listener: () => void) => {
        branchListener = listener;
        return () => {
          branchUnsubscribed = true;
          branchListener = undefined;
        };
      },
    },
  );
  return { component, renders: () => renders, branchListener: () => branchListener, branchUnsubscribed: () => branchUnsubscribed };
}

describe('custom footer registration', () => {
  test('handles updates, requests renders, and ignores invalid names', () => {
    const app = harness();
    const session = startSession(app);
    const mounted = createComponent(session.getFactory()!);
    const event = app.eventHandlers.get(SET_AGENT_NAME_EVENT_ID)!;

    event({ agentName: 'Builder', color: '#123456' });
    expect(mounted.renders()).toBe(1);
    event({ agentName: '   ' });
    expect(mounted.renders()).toBe(1);
  });

  test('resets identity on each session and disposes component subscriptions', () => {
    const app = harness();
    const session = startSession(app);
    const mounted = createComponent(session.getFactory()!);
    const event = app.eventHandlers.get(SET_AGENT_NAME_EVENT_ID)!;

    event({ agentName: 'Builder', color: '#123456' });
    app.setDefaultAgentName('Reviewer');
    app.handlers.get('session_start')?.[0]?.({}, session.ctx);
    expect(mounted.renders()).toBe(2);

    mounted.component.dispose();
    event({ agentName: 'After Dispose' });
    mounted.branchListener()?.();
    expect(mounted.renders()).toBe(2);
    expect(mounted.branchUnsubscribed()).toBe(true);
  });
});
