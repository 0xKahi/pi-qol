import { describe, expect, test } from 'bun:test';
import type { BuildSystemPromptOptions, ExtensionAPI, ExtensionContext } from '@earendil-works/pi-coding-agent';
import { CompactionState, InitialCaptureState, SilentProbeState } from '../../src/extensions/context-view/capture';
import { prepareContextViewData } from '../../src/extensions/context-view/context-view-controller';
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
