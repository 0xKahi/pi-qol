import assert from 'node:assert/strict';
import { test } from 'node:test';

import type {
  BeforeAgentStartEvent,
  BuildSystemPromptOptions,
  ContextEvent,
  ExtensionAPI,
  ExtensionContext,
  SessionEntry,
  SessionStartEvent,
} from '@earendil-works/pi-coding-agent';
// Deep import bypasses the package barrel, which does not re-export the option normalizer.
import { normalizeBuildSystemPromptOptions } from '../../node_modules/@earendil-works/pi-coding-agent/dist/core/system-prompt.js';
import type { ConfigLoader } from '../../src/config-loader';
import { PROBE_IDENTITIES_CUSTOM_TYPE } from '../../src/extensions/context-view/capture.ts';
import { PI_VIM_KEY_EVENT_ID } from '../../src/extensions/context-view/constants.ts';
import { registerContextView } from '../../src/extensions/context-view/index.ts';

type AnyHandler = (...args: any[]) => any;

/** Minimal fake host that dispatches registered handlers like Pi's extension runner. */
function createHost() {
  const handlers = new Map<string, AnyHandler[]>();
  const commands = new Map<string, AnyHandler>();
  const eventHandlers = new Map<string, AnyHandler>();
  const appendEntries: Array<{ customType: string; data: unknown }> = [];
  let enabled = true;
  let sends = 0;
  let sendHook: (text: string) => void = () => {};

  const pi = {
    on(name: string, handler: AnyHandler) {
      handlers.set(name, [...(handlers.get(name) ?? []), handler]);
      return () => {};
    },
    registerCommand(name: string, command: { handler: AnyHandler }) {
      commands.set(name, command.handler);
    },
    events: {
      on(name: string, handler: AnyHandler) {
        eventHandlers.set(name, handler);
      },
    },
    appendEntry(customType: string, data: unknown) {
      appendEntries.push({ customType, data });
    },
    getAllTools: () => [],
    getActiveTools: () => [],
    getCommands: () => [],
    sendUserMessage(text: string) {
      sends++;
      sendHook(text);
    },
  } as unknown as ExtensionAPI;

  const config = {
    isEnabled: () => enabled,
    getContextView: () => ({ layout: 'inline' }),
  } as unknown as ConfigLoader;
  registerContextView(pi, { config });

  return {
    pi,
    handlers,
    commands,
    eventHandlers,
    appendEntries,
    emit: (name: string, event: unknown, ctx: unknown): unknown[] => [...(handlers.get(name) ?? [])].map(handler => handler(event, ctx)),
    get sends() {
      return sends;
    },
    set enabled(value: boolean) {
      enabled = value;
    },
    set sendHook(value: (text: string) => void) {
      sendHook = value;
    },
  };
}

interface ContextOptions {
  waitForIdle?: () => Promise<void>;
  getSystemPromptOptions?: () => BuildSystemPromptOptions;
  entries?: SessionEntry[];
  leafId?: string | null;
}

/** Fake ExtensionContext with command-capable APIs and observable UI side effects. */
function createContext(options: ContextOptions = {}) {
  const notifications: Array<[string, string]> = [];
  const workingVisible: boolean[] = [];
  let aborts = 0;
  let customCalls = 0;

  const ctx = {
    mode: 'tui',
    cwd: '/tmp',
    model: undefined,
    modelRegistry: { hasConfiguredAuth: () => false },
    isProjectTrusted: () => false,
    abort: () => {
      aborts++;
    },
    getSystemPrompt: () => 'system prompt',
    getContextUsage: () => undefined,
    sessionManager: {
      getEntries: () => options.entries ?? [],
      getLeafId: () => options.leafId ?? null,
    },
    ui: {
      notify: (message: string, type: string) => notifications.push([message, type]),
      setWorkingVisible: (visible: boolean) => workingVisible.push(visible),
      custom: async () => {
        customCalls++;
        return undefined;
      },
    },
    ...(options.waitForIdle ? { waitForIdle: options.waitForIdle } : {}),
    ...(options.getSystemPromptOptions ? { getSystemPromptOptions: options.getSystemPromptOptions } : {}),
  } as unknown as ExtensionContext;

  return {
    ctx,
    notifications,
    get aborts() {
      return aborts;
    },
    get customCalls() {
      return customCalls;
    },
    get workingVisible() {
      return workingVisible;
    },
  };
}

/** Authorize the silent probe on a fake context. */
function withAuthenticatedModel(context: ReturnType<typeof createContext>): void {
  (context.ctx as { model: unknown; modelRegistry: unknown }).model = { id: 'test', provider: 'anthropic' };
  (context.ctx as { modelRegistry: unknown }).modelRegistry = { hasConfiguredAuth: () => true };
}

function startEvent(): SessionStartEvent {
  return { type: 'session_start', reason: 'startup' } as SessionStartEvent;
}

function agentStartEvent(prompt: string, systemPrompt: string): BeforeAgentStartEvent {
  return {
    type: 'before_agent_start',
    prompt,
    systemPrompt,
    systemPromptOptions: normalizeBuildSystemPromptOptions({ cwd: '/tmp' }),
  } as BeforeAgentStartEvent;
}

/** Poll microtasks until a predicate holds, failing the test when it never does. */
async function waitFor(predicate: () => boolean): Promise<void> {
  for (let index = 0; index < 50 && !predicate(); index++) {
    await new Promise(resolve => setTimeout(resolve, 0));
  }
  assert.ok(predicate(), 'condition was not met');
}

/** User message fixture for context events. */
function userMessage(content: string, timestamp: number): ContextEvent['messages'][number] {
  return { role: 'user', content, timestamp } satisfies ContextEvent['messages'][number];
}

test('context handler skips the session baseline rebuild after the Initial snapshot freezes', () => {
  const host = createHost();

  // A resumed session with one real user message and the probe identities
  // persisted by a prior runtime.
  const probeUser = { role: 'user', content: [], timestamp: 10 } satisfies ContextEvent['messages'][number];
  const entries: SessionEntry[] = [
    {
      type: 'message',
      id: '1',
      parentId: null,
      timestamp: '2026-08-22T10:00:00Z',
      message: userMessage('hello', 1),
    },
    {
      type: 'custom',
      id: '2',
      parentId: '1',
      timestamp: '2026-08-22T10:01:00Z',
      customType: PROBE_IDENTITIES_CUSTOM_TYPE,
      data: { messages: [{ role: 'user', timestamp: 10 }] },
    },
  ];
  let sessionReads = 0;
  const context = createContext({
    getSystemPromptOptions: () => ({ cwd: '/tmp' }),
    entries,
    leafId: '2',
  });
  context.ctx.sessionManager.getEntries = () => {
    sessionReads += 1;
    return entries;
  };

  // Activate the lazily registered extension, rehydrating the persisted probe identity.
  host.emit('session_start', startEvent(), context.ctx);
  const agentStart = host.handlers.get('before_agent_start')?.[0] as (event: BeforeAgentStartEvent, ctx: ExtensionContext) => unknown;
  agentStart(agentStartEvent('hello', 'system prompt'), context.ctx);
  assert.equal(sessionReads, 1);

  const first = host.emit('context', { type: 'context', messages: [probeUser, userMessage('hello', 1)] }, context.ctx);
  assert.equal(sessionReads, 2, 'the first context event builds the session baseline');
  assert.deepEqual(first, [{ messages: [userMessage('hello', 1)] }]);

  const second = host.emit('context', { type: 'context', messages: [probeUser, userMessage('again', 2)] }, context.ctx);
  assert.equal(sessionReads, 2, 'a frozen snapshot must not rebuild the session baseline');
  assert.deepEqual(second, [{ messages: [userMessage('again', 2)] }]);
});

test('token probe lifecycle: input reset, run claim, message sanitization, and identity persistence', async () => {
  const host = createHost();
  const context = createContext({ getSystemPromptOptions: () => ({ cwd: '/tmp' }) });
  withAuthenticatedModel(context);
  const probeUser = userMessage('XYZZY_MARKER_TRANSFORM: prepended instructions\n', 10);
  const realUser = userMessage('hello', 11);

  let inputResult: unknown;
  let messageEndResult: unknown;
  host.sendHook = () => {
    // Another extension rewrote the synthetic empty prompt; the token still owns it.
    inputResult = host.emit(
      'input',
      { type: 'input', text: 'XYZZY_MARKER_TRANSFORM: prepended instructions\n', source: 'extension' },
      context.ctx,
    )[0];
    host.emit('before_agent_start', agentStartEvent('', 'system prompt'), context.ctx);
    host.emit('turn_start', { type: 'turn_start' }, context.ctx);
    host.emit('message_start', { type: 'message_start', message: probeUser }, context.ctx);
    messageEndResult = host.emit('message_end', { type: 'message_end', message: probeUser }, context.ctx)[0];
    host.emit('context', { type: 'context', messages: [probeUser, realUser] }, context.ctx);
    host.emit('agent_settled', { type: 'agent_settled' }, context.ctx);
  };

  host.emit('session_start', startEvent(), context.ctx);
  await host.commands.get('context-view')?.('', context.ctx);

  assert.deepEqual(inputResult, { action: 'transform', text: '' }, 'the probe prompt is reset to empty');
  assert.equal(context.aborts, 1, 'the token-owned probe run is aborted');
  assert.deepEqual(messageEndResult, { message: { role: 'user', content: [], timestamp: 10 } }, 'the probe prompt is blanked for the transcript');
  assert.deepEqual(
    host.appendEntries,
    [{ customType: PROBE_IDENTITIES_CUSTOM_TYPE, data: { messages: [{ role: 'user', timestamp: 10 }] } }],
    'settlement persists only role and timestamp',
  );
  assert.equal(context.customCalls, 1, 'the view opens after the probe captures');
});

test('an untokenized real run fails the pending probe instead of aborting it', async () => {
  const host = createHost();
  const context = createContext({ getSystemPromptOptions: () => ({ cwd: '/tmp' }) });
  withAuthenticatedModel(context);
  // Start the probe but emit nothing: the run below is the untokenized real turn.
  host.sendHook = () => {};

  host.emit('session_start', startEvent(), context.ctx);
  const pending = host.commands.get('context-view')?.('', context.ctx);
  await waitFor(() => host.sends === 1);

  host.handlers.get('before_agent_start')?.[0]?.(agentStartEvent('real prompt', 'system prompt'), context.ctx);
  host.emit('turn_start', { type: 'turn_start' }, context.ctx);
  await pending;

  assert.equal(context.aborts, 0, 'a run the probe cannot prove it owns must run untouched');
  assert.deepEqual(host.appendEntries, [], 'an unrecognized probe never persists identities');
});

test('a second session_start does not register the extension twice', () => {
  const host = createHost();
  const context = createContext();

  host.emit('session_start', startEvent(), context.ctx);
  assert.equal(host.handlers.get('input')?.length, 1);
  assert.equal(host.commands.size, 1);
  assert.equal(host.eventHandlers.size, 1);

  host.emit('session_start', startEvent(), context.ctx);
  assert.equal(host.handlers.get('input')?.length, 1, 'handlers stay singular across sessions');
  assert.equal(host.commands.size, 1);
  assert.equal(host.eventHandlers.size, 1);
});

test('the Vim event opens the view from the latest context after a frozen Initial', async () => {
  const host = createHost();
  const context = createContext({ getSystemPromptOptions: () => ({ cwd: '/tmp' }) });
  host.emit('session_start', startEvent(), context.ctx);

  // Freeze a real-turn Initial through the registered lifecycle handlers.
  host.handlers.get('before_agent_start')?.[0]?.(agentStartEvent('hello', 'system prompt'), context.ctx);
  host.emit('context', { type: 'context', messages: [userMessage('hello', 1)] }, context.ctx);

  const open = host.eventHandlers.get(PI_VIM_KEY_EVENT_ID);
  assert.ok(open !== undefined, 'the Vim event handler is registered');
  open?.();
  await waitFor(() => context.customCalls === 1);
  assert.equal(context.customCalls, 1, 'the Vim event mounts the modal');
  assert.equal(context.aborts, 0);
});

test('session_shutdown persists and fails an in-flight probe even when config is disabled', async () => {
  const host = createHost();
  const context = createContext({ getSystemPromptOptions: () => ({ cwd: '/tmp' }) });
  withAuthenticatedModel(context);
  const probeUser = userMessage('transformed instructions', 10);
  host.sendHook = () => {
    host.emit('before_agent_start', agentStartEvent('', 'system prompt'), context.ctx);
    host.emit('message_start', { type: 'message_start', message: probeUser }, context.ctx);
    // Leave the probe running: shutdown owns cleanup.
  };

  host.emit('session_start', startEvent(), context.ctx);
  const pending = host.commands.get('context-view')?.('', context.ctx);
  await waitFor(() => host.sends === 1);

  host.enabled = false;
  host.emit('session_shutdown', { type: 'session_shutdown' }, context.ctx);
  await pending;

  assert.deepEqual(host.appendEntries, [{ customType: PROBE_IDENTITIES_CUSTOM_TYPE, data: { messages: [{ role: 'user', timestamp: 10 }] } }]);
});
