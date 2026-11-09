import { describe, expect, test } from 'bun:test';
import { type BuildSystemPromptOptions, type ExtensionAPI, type ExtensionContext, SettingsManager } from '@earendil-works/pi-coding-agent';
import { CompactionState, InitialCaptureState, SilentProbeState } from '../../src/extensions/context-view/capture';
import { VIRTUAL_MODEL_API } from '../../src/extensions/context-view/constants';
import { checkProbeStartConditions, prepareContextViewData } from '../../src/extensions/context-view/context-view-controller';
import { readProbeToken } from '../../src/extensions/context-view/probe-token';

const options: BuildSystemPromptOptions = { cwd: '/tmp' };
const systemPrompt = 'Base prompt\nCurrent working directory: /tmp';

function capturedState(): InitialCaptureState {
  const capture = new InitialCaptureState();
  capture.prepare(options);
  capture.finalize(() => ({
    systemPrompt,
    messages: [],
    baselineMessages: [],
    allTools: [],
    activeToolNames: [],
    origin: 'real-turn',
  }));
  return capture;
}

/** Owned options without a frozen Initial, forcing the probe path. */
function preparedState(): InitialCaptureState {
  const capture = new InitialCaptureState();
  capture.prepare(options);
  return capture;
}

function context(waitForIdle?: () => Promise<void>): ExtensionContext {
  return {
    mode: 'tui',
    hasUI: true,
    isIdle: () => true,
    hasPendingMessages: () => false,
    isProjectTrusted: () => false,
    cwd: '/tmp',
    model: undefined,
    modelRegistry: {},
    sessionManager: { getEntries: () => [], getLeafId: () => null },
    getSystemPrompt: () => systemPrompt,
    getContextUsage: () => undefined,
    ui: { setWorkingVisible: () => undefined },
    ...(waitForIdle ? { waitForIdle } : {}),
  } as unknown as ExtensionContext;
}

const pi = {
  getAllTools: () => [],
  getActiveTools: () => [],
  getCommands: () => [],
} as unknown as ExtensionAPI;

describe('checkProbeStartConditions', () => {
  const settings = () => SettingsManager.inMemory({ cacheWarming: 'off', compaction: { enabled: true, reserveTokens: 100 } });
  const authenticated = () =>
    ({
      ...context(),
      model: { id: 'test', provider: 'test', api: 'anthropic-messages' },
      modelRegistry: { hasConfiguredAuth: () => true },
    }) as unknown as ExtensionContext;

  const cases: Array<{
    name: string;
    reason: string;
    ctx?: () => ExtensionContext;
    autoProbing?: boolean;
    read?: () => ReturnType<typeof settings>;
    compact?: boolean;
  }> = [
    { name: 'disabled auto_probing', reason: 'automatic probing is disabled', autoProbing: false },
    { name: 'non-presentable host', reason: 'TUI presentation', ctx: () => ({ ...authenticated(), hasUI: false }) },
    {
      name: 'failed idle wait',
      reason: 'waiting for idle failed',
      ctx: () =>
        ({
          ...authenticated(),
          waitForIdle: async () => {
            throw new Error('busy');
          },
        }) as ExtensionContext,
    },
    { name: 'busy event context without idle wait', reason: 'not idle', ctx: () => ({ ...authenticated(), isIdle: () => false }) },
    { name: 'active compaction', reason: 'compaction is in progress', compact: true },
    { name: 'queued input', reason: 'queued input', ctx: () => ({ ...authenticated(), hasPendingMessages: () => true }) },
    { name: 'missing model', reason: 'no model is selected', ctx: () => context() },
    {
      name: 'virtual model',
      reason: 'virtual model',
      ctx: () => ({ ...authenticated(), model: { ...authenticated().model, api: VIRTUAL_MODEL_API } }) as unknown as ExtensionContext,
    },
    {
      name: 'missing auth',
      reason: 'no configured authentication',
      ctx: () => ({ ...authenticated(), modelRegistry: { hasConfiguredAuth: () => false } }) as unknown as ExtensionContext,
    },
    { name: 'idle cache warming', reason: 'idle cache warming', read: () => SettingsManager.inMemory({ cacheWarming: 'idle' }) },
    {
      name: 'compaction threshold',
      reason: 'auto-compaction threshold',
      ctx: () => ({ ...authenticated(), getContextUsage: () => ({ tokens: 950, contextWindow: 1000, percent: 95 }) }) as ExtensionContext,
    },
    {
      name: 'unreadable settings',
      reason: 'settings unreadable',
      read: () => {
        throw new Error('read failed');
      },
    },
    {
      name: 'unreadable compaction settings with unknown usage',
      reason: 'settings unreadable',
      read: () => {
        const manager = settings();
        manager.getCompactionSettings = () => {
          throw new Error('invalid settings');
        };
        return manager;
      },
    },
    {
      name: 'settings load errors',
      reason: 'settings unreadable',
      read: () =>
        ({ ...settings(), drainErrors: () => [{ scope: 'global', error: new Error('bad JSON') }] }) as unknown as ReturnType<typeof settings>,
    },
  ];
  for (const entry of cases) {
    test(`${entry.name} sends nothing and leaves the attempt available`, async () => {
      let sends = 0;
      const probe = new SilentProbeState();
      const compaction = new CompactionState();
      if (entry.compact) compaction.begin(new AbortController().signal);
      const data = await prepareContextViewData(
        {
          ...pi,
          sendUserMessage: () => {
            sends++;
          },
        } as ExtensionAPI,
        entry.ctx?.() ?? authenticated(),
        preparedState(),
        probe,
        compaction,
        {
          autoProbing: entry.autoProbing,
          readProbeSettings: entry.read ?? settings,
        },
      );
      expect(data.degradedReason).toContain(entry.reason);
      expect(sends).toBe(0);
      expect(probe.start().started).toBe(true);
      probe.fail('cleanup');
    });
  }

  test('virtual API discriminator matches Pi and unknown usage is below threshold', async () => {
    expect(VIRTUAL_MODEL_API).toBe('pi-virtual');
    expect(await checkProbeStartConditions(authenticated(), { compaction: new CompactionState(), readProbeSettings: settings })).toBe('ok');
  });

  test('disabled probing is checked before idle waiting and settings', async () => {
    const ctx = {
      ...authenticated(),
      waitForIdle: async () => {
        throw new Error('must not wait');
      },
    };
    expect(
      await checkProbeStartConditions(ctx, {
        compaction: new CompactionState(),
        autoProbing: false,
        readProbeSettings: () => {
          throw new Error('must not read');
        },
      }),
    ).toContain('disabled');
  });

  test('disabled auto-compaction permits usage above its threshold', async () => {
    const ctx = { ...authenticated(), getContextUsage: () => ({ tokens: 1000, contextWindow: 1000, percent: 100 }) } as ExtensionContext;
    expect(
      await checkProbeStartConditions(ctx, {
        compaction: new CompactionState(),
        readProbeSettings: () => SettingsManager.inMemory({ compaction: { enabled: false } }),
      }),
    ).toBe('ok');
  });
});

describe('prepareContextViewData', () => {
  test('prepares data from an ordinary event context without command-only APIs', async () => {
    const data = await prepareContextViewData(pi, context(), capturedState(), new SilentProbeState(), new CompactionState());
    expect(data.initial.origin).toBe('real-turn');
    expect(data.usage.categories[0]?.label).toBe('System Prompt');
  });

  test('does not wait for idle when Initial is already frozen', async () => {
    let waits = 0;
    const data = await prepareContextViewData(
      pi,
      context(async () => {
        waits++;
      }),
      capturedState(),
      new SilentProbeState(),
      new CompactionState(),
    );
    // A frozen snapshot opens during a run instead of blocking on agent settlement.
    expect(waits).toBe(0);
    expect(data.initial.origin).toBe('real-turn');
    expect(data.degradedReason).toBeUndefined();
  });

  test('waits for idle before probing when Initial is not frozen', async () => {
    let waits = 0;
    let sends = 0;
    const capture = preparedState();
    const probe = new SilentProbeState();
    const promptContext = {
      ...context(async () => {
        waits++;
      }),
      model: { id: 'test' },
      modelRegistry: { hasConfiguredAuth: () => true },
      getSystemPromptOptions: () => options,
    } as unknown as ExtensionContext;
    const probingPi = {
      ...pi,
      sendUserMessage: () => {
        sends++;
        probe.beginRun(readProbeToken());
        capture.finalize(() => ({ systemPrompt, messages: [], baselineMessages: [], allTools: [], activeToolNames: [], origin: 'synthetic-probe' }));
        probe.settle(true);
      },
    } as unknown as ExtensionAPI;

    const data = await prepareContextViewData(probingPi, promptContext, capture, probe, new CompactionState());
    expect(waits).toBe(1);
    expect(sends).toBe(1);
    expect(data.initial.origin).toBe('synthetic-probe');
    expect(data.degradedReason).toBeUndefined();
  });

  test('distinguishes no-model from missing-auth degraded reasons', async () => {
    const noModel = await prepareContextViewData(pi, context(), preparedState(), new SilentProbeState(), new CompactionState());
    expect(noModel.degradedReason).toContain('no model is selected');

    const missingAuth = {
      ...context(),
      model: { id: 'test', provider: 'anthropic' },
      modelRegistry: { hasConfiguredAuth: () => false },
    } as unknown as ExtensionContext;
    const unauthenticated = await prepareContextViewData(pi, missingAuth, preparedState(), new SilentProbeState(), new CompactionState());
    expect(unauthenticated.degradedReason).toContain('anthropic has no configured authentication');
  });

  test('does not consume the silent probe during compaction and allows a later attempt', async () => {
    const capture = new InitialCaptureState();
    capture.prepare(options);
    const probe = new SilentProbeState();
    const compaction = new CompactionState();
    const signal = new AbortController();
    compaction.begin(signal.signal);
    const promptContext = {
      ...context(),
      model: { id: 'test' },
      modelRegistry: { hasConfiguredAuth: () => true },
      getSystemPromptOptions: () => options,
    } as unknown as ExtensionContext;
    let sends = 0;
    const probingPi = {
      ...pi,
      sendUserMessage: () => {
        sends++;
        probe.beginRun(readProbeToken());
        capture.finalize(() => ({ systemPrompt, messages: [], baselineMessages: [], allTools: [], activeToolNames: [], origin: 'synthetic-probe' }));
        probe.settle(true);
      },
    } as unknown as ExtensionAPI;

    const degraded = await prepareContextViewData(probingPi, promptContext, capture, probe, compaction);
    expect(degraded.degradedReason).toContain('compaction is in progress');
    expect(sends).toBe(0);

    compaction.finish();
    const captured = await prepareContextViewData(probingPi, promptContext, capture, probe, compaction);
    expect(captured.degradedReason).toBeUndefined();
    expect(sends).toBe(1);
  });

  test('passes enabled reserve settings and omits disabled or unreadable values', async () => {
    const cases: Array<[number | undefined, number | undefined]> = [
      [16_384, 16_384],
      [undefined, undefined],
    ];
    for (const [readValue, expected] of cases) {
      const data = await prepareContextViewData(pi, context(), capturedState(), new SilentProbeState(), new CompactionState(), {
        readAutoCompactReserveTokens: () => readValue,
      });
      expect(data.usage.autoCompactReserveTokens).toBe(expected);
    }
    const unreadable = await prepareContextViewData(pi, context(), capturedState(), new SilentProbeState(), new CompactionState(), {
      readAutoCompactReserveTokens: () => undefined,
    });
    expect(unreadable.usage.autoCompactReserveTokens).toBeUndefined();
  });
});
