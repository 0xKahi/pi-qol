import { buildSessionContext, type ExtensionAPI, type ExtensionContext, SettingsManager } from '@earendil-works/pi-coding-agent';
import { buildNativeSnapshot, type CompactionState, type InitialCaptureState, mergeContextOnlyMessages, type SilentProbeState } from './capture';
import type { ContextUsageSnapshot, InitialSnapshot } from './model';
import { computeUsage, toReportedUsage } from './usage';

export interface ContextViewData {
  initial: InitialSnapshot;
  usage: ContextUsageSnapshot;
  degradedReason?: string;
}

type PromptContext = ExtensionContext & {
  getSystemPromptOptions?: () => Parameters<typeof buildNativeSnapshot>[0]['options'];
  waitForIdle?: () => Promise<void>;
};

interface ContextViewDependencies {
  readAutoCompactReserveTokens?: (ctx: PromptContext) => number | undefined;
}

/** Read Pi's effective merged compaction reserve; optional settings never block the view. */
export function readAutoCompactReserveTokens(ctx: PromptContext): number | undefined {
  try {
    const settings = SettingsManager.create(ctx.cwd, undefined, { projectTrusted: ctx.isProjectTrusted() });
    if (!settings.getCompactionEnabled()) return undefined;
    return settings.getCompactionReserveTokens();
  } catch {
    return undefined;
  }
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
  if (ctx.waitForIdle) await ctx.waitForIdle();
  let initial = capture.snapshot;
  let degradedReason: string | undefined;

  if (!initial) {
    if (compaction.isActive) {
      degradedReason = 'Silent probe unavailable: context compaction is in progress. Extension additions were not observed.';
    } else {
      const attempt = probe.start();
      if (attempt.started && ctx.model && ctx.modelRegistry.hasConfiguredAuth(ctx.model)) {
        try {
          pi.sendUserMessage('');
        } catch (error) {
          probe.fail(error instanceof Error ? error.message : String(error));
        }
      } else if (attempt.started) {
        probe.fail('Silent probe unavailable: no authenticated model is selected.');
      }
      const outcome = await attempt.completion;
      initial = capture.snapshot;
      if (!initial)
        degradedReason = `${outcome.status === 'failed' ? outcome.reason : 'Silent probe did not capture Initial.'} Extension additions were not observed.`;
    }
  }

  const options = capture.promptOptions ?? ctx.getSystemPromptOptions?.();
  if (!options) {
    throw new Error('Context View has not received prompt options yet. Start an agent turn and try again.');
  }
  const current = buildNativeSnapshot({
    systemPrompt: ctx.getSystemPrompt(),
    options,
    allTools: pi.getAllTools(),
    activeToolNames: pi.getActiveTools(),
  });
  const fallback = initial ?? current;
  const messages = probe.filterMessages(buildSessionContext(ctx.sessionManager.getEntries(), ctx.sessionManager.getLeafId()).messages);
  const reserveReader = dependencies.readAutoCompactReserveTokens ?? readAutoCompactReserveTokens;
  return {
    initial: fallback,
    degradedReason,
    usage: computeUsage({
      snapshot: mergeContextOnlyMessages(current, fallback),
      messages,
      reported: toReportedUsage(ctx.getContextUsage()),
      modelLabel: ctx.model?.id,
      autoCompactReserveTokens: reserveReader(ctx),
    }),
  };
}
