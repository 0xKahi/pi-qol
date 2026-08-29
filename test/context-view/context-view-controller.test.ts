import { describe, expect, test } from 'bun:test';
import type { BuildSystemPromptOptions, ExtensionAPI, ExtensionContext } from '@earendil-works/pi-coding-agent';
import { CompactionState, InitialCaptureState, SilentProbeState } from '../../src/extensions/context-view/capture';
import { prepareContextViewData } from '../../src/extensions/context-view/context-view-controller';

const options: BuildSystemPromptOptions = { cwd: '/tmp' };
const systemPrompt = 'Base prompt\nCurrent working directory: /tmp';

function capturedState(): InitialCaptureState {
  const capture = new InitialCaptureState();
  capture.prepare(options);
  capture.finalize({
    systemPrompt,
    messages: [],
    baselineMessages: [],
    allTools: [],
    activeToolNames: [],
    origin: 'real-turn',
  });
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
    ...(waitForIdle ? { waitForIdle } : {}),
  } as unknown as ExtensionContext;
}

const pi = {
  getAllTools: () => [],
  getActiveTools: () => [],
} as unknown as ExtensionAPI;

describe('prepareContextViewData', () => {
  test('prepares data from an ordinary event context without command-only APIs', async () => {
    const data = await prepareContextViewData(pi, context(), capturedState(), new SilentProbeState(), new CompactionState());
    expect(data.initial.origin).toBe('real-turn');
    expect(data.usage.categories[0]?.label).toBe('System Prompt');
  });

  test('waits for idle when invoked with a command context', async () => {
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
    expect(waits).toBe(1);
    expect(data.degradedReason).toBeUndefined();
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
        probe.observeInput('extension', '');
        probe.beginRun('');
        capture.finalize({ systemPrompt, messages: [], baselineMessages: [], allTools: [], activeToolNames: [], origin: 'synthetic-probe' });
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
    const cases: Array<[number | undefined, number | undefined]> = [[16_384, 16_384], [undefined, undefined]];
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
