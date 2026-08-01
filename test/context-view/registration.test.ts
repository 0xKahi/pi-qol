import { describe, expect, test } from 'bun:test';
import type { ExtensionAPI, ExtensionContext } from '@earendil-works/pi-coding-agent';
import type { ConfigLoader } from '../../src/config-loader';
import { registerContextView } from '../../src/extensions/context-view';

type Handler = (...args: any[]) => any;

function harness(enabled: boolean) {
  const handlers = new Map<string, Handler[]>();
  const commands = new Map<string, { handler: Handler }>();
  const eventHandlers = new Map<string, Handler>();
  const pi = {
    on: (name: string, handler: Handler) => handlers.set(name, [...(handlers.get(name) ?? []), handler]),
    registerCommand: (name: string, command: { handler: Handler }) => commands.set(name, command),
    events: { on: (name: string, handler: Handler) => eventHandlers.set(name, handler) },
  } as unknown as ExtensionAPI;
  const config = { isEnabled: () => enabled } as unknown as ConfigLoader;
  registerContextView(pi, { config });
  return { handlers, commands, eventHandlers };
}

function context(mode: 'tui' | 'rpc' = 'tui') {
  const notifications: Array<[string, string]> = [];
  return {
    mode,
    sessionManager: { getEntries: () => [] },
    ui: { notify: (message: string, type: string) => notifications.push([message, type]) },
    notifications,
  } as unknown as ExtensionContext & { notifications: Array<[string, string]> };
}

describe('Context View registration', () => {
  test('does not register commands, events, or capture handlers while disabled', () => {
    const app = harness(false);
    app.handlers.get('session_start')?.[0]?.({}, context());
    expect(app.commands.size).toBe(0);
    expect(app.eventHandlers.size).toBe(0);
    expect(app.handlers.has('context')).toBe(false);
  });

  test('registers lazily after an enabled session and validates command invocation', async () => {
    const app = harness(true);
    const ctx = context();
    app.handlers.get('session_start')?.[0]?.({}, ctx);
    expect(app.commands.has('context-view')).toBe(true);
    expect(app.eventHandlers.has('pi.vimKeys.event:pi-qol.context_view')).toBe(true);

    await app.commands.get('context-view')?.handler('unexpected', ctx);
    expect(ctx.notifications.at(-1)?.[0]).toBe('/context-view accepts no arguments.');

    const rpc = context('rpc');
    await app.commands.get('context-view')?.handler('', rpc);
    expect(rpc.notifications.at(-1)?.[0]).toBe('/context-view requires TUI mode.');
  });
});
