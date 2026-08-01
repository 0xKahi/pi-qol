import { describe, expect, test } from 'bun:test';
import type { BuildSystemPromptOptions, ExtensionAPI, ExtensionContext } from '@earendil-works/pi-coding-agent';
import { InitialCaptureState, SilentProbeState } from '../../src/extensions/context-view/capture';
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
    const data = await prepareContextViewData(pi, context(), capturedState(), new SilentProbeState());
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
    );
    expect(waits).toBe(1);
    expect(data.degradedReason).toBeUndefined();
  });
});
