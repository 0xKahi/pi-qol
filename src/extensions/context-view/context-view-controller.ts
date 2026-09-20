import {
  type BuildSystemPromptOptions,
  buildSessionContext,
  type ExtensionAPI,
  type ExtensionCommandContext,
  type ExtensionContext,
} from '@earendil-works/pi-coding-agent';
import {
  buildNativeSnapshot,
  buildUsageSnapshot,
  type CompactionState,
  collectPromptSources,
  type InitialCaptureState,
  type SilentProbeState,
} from './capture';
import type { ContextUsageSnapshot, InitialSnapshot } from './model';
import { runWithProbeToken } from './probe-token';
import { readAutoCompactReserveTokens } from './settings';
import { computeUsage, toReportedUsage } from './usage';

export interface ContextViewData {
  initial: InitialSnapshot;
  usage: ContextUsageSnapshot;
  degradedReason?: string;
}

type PromptContext = ExtensionContext & {
  getSystemPromptOptions?: () => BuildSystemPromptOptions;
  waitForIdle?: () => Promise<void>;
};

interface ContextViewDependencies {
  readAutoCompactReserveTokens?: (ctx: PromptContext) => number | undefined;
}

/** Read Pi's effective merged compaction reserve; optional settings never block the view. */
function defaultReserveReader(ctx: PromptContext): number | undefined {
  return readAutoCompactReserveTokens(ctx as unknown as ExtensionCommandContext);
}

/** Prepare Context View data without requiring command-only APIs for event callers. */
export async function prepareContextViewData(
  pi: ExtensionAPI,
  ctx: PromptContext,
  capture: InitialCaptureState,
  probe: SilentProbeState,
  compaction: CompactionState,
  dependencies: ContextViewDependencies = {},
): Promise<ContextViewData> {
  let initial = capture.snapshot;
  let degradedReason: string | undefined;

  // A frozen Initial never needs the agent to settle first: opening the view
  // during a run must show the captured state immediately, unlike a probe.
  if (!initial) {
    if (ctx.waitForIdle) await ctx.waitForIdle();
    initial = capture.snapshot;
  }

  if (!initial) {
    if (compaction.isActive) {
      degradedReason = 'Silent probe unavailable: context compaction is in progress. Extension additions were not observed.';
    } else if (ctx.model === undefined) {
      degradedReason = 'Silent probe unavailable: no model is selected. Extension additions were not observed.';
    } else if (!ctx.modelRegistry.hasConfiguredAuth(ctx.model)) {
      degradedReason = `Silent probe unavailable: ${ctx.model.provider} has no configured authentication. Extension additions were not observed.`;
    } else {
      const attempt = probe.start();
      if (attempt.started) {
        ctx.ui.setWorkingVisible(false);
        try {
          // Pi emits `input` and `before_agent_start` from inside this call, so the
          // token reaches both handlers and identifies the run even when another
          // extension's input transform rewrites the prompt text.
          runWithProbeToken(attempt.token, () => pi.sendUserMessage(''));
        } catch (error) {
          probe.fail(error instanceof Error ? error.message : String(error));
        }
      }
      try {
        const outcome = await attempt.completion;
        initial = capture.snapshot;
        if (!initial) {
          degradedReason = `${outcome.status === 'failed' ? outcome.reason : 'Silent probe did not capture Initial.'} Extension additions were not observed.`;
        }
      } finally {
        if (attempt.started) ctx.ui.setWorkingVisible(true);
      }
    }
  }

  const options = ctx.getSystemPromptOptions?.() ?? capture.promptOptions;
  if (!options) {
    throw new Error('Context View has not received prompt options yet. Start an agent turn and try again.');
  }
  const allTools = pi.getAllTools();
  const activeToolNames = pi.getActiveTools();
  const promptSources = collectPromptSources(allTools, pi.getCommands());
  const native = buildNativeSnapshot({
    systemPrompt: ctx.getSystemPrompt(),
    options,
    allTools,
    activeToolNames,
    promptSources,
  });
  const fallback = initial ?? native;
  const messages = probe.filterMessages(buildSessionContext(ctx.sessionManager.getEntries(), ctx.sessionManager.getLeafId()).messages);
  const reserveReader = dependencies.readAutoCompactReserveTokens ?? defaultReserveReader;
  return {
    initial: fallback,
    degradedReason,
    usage: computeUsage({
      snapshot: buildUsageSnapshot({
        messages,
        initial: fallback,
        systemPrompt: ctx.getSystemPrompt(),
        options,
        allTools,
        activeToolNames,
        promptSources,
      }),
      messages,
      reported: toReportedUsage(ctx.getContextUsage()),
      modelLabel: ctx.model?.id,
      autoCompactReserveTokens: reserveReader(ctx),
    }),
  };
}
