import {
  type BuildSystemPromptOptions,
  buildSessionContext,
  type ExtensionAPI,
  type ExtensionCommandContext,
  type ExtensionContext,
  SettingsManager,
  shouldCompact,
} from '@earendil-works/pi-coding-agent';
import {
  buildNativeSnapshot,
  buildUsageSnapshot,
  type CompactionState,
  collectPromptSources,
  type InitialCaptureState,
  type SilentProbeState,
} from './capture';
import { VIRTUAL_MODEL_API } from './constants';
import type { ContextUsageSnapshot, InitialSnapshot } from './model';
import { canPresent } from './presentation';
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
  autoProbing?: boolean;
  readProbeSettings?: (
    ctx: PromptContext,
  ) => Pick<SettingsManager, 'getCacheWarmingMode' | 'getCompactionSettings'> & Partial<Pick<SettingsManager, 'drainErrors'>>;
  readAutoCompactReserveTokens?: (ctx: PromptContext) => number | undefined;
}

/** Read Pi's effective merged compaction reserve; optional settings never block the view. */
function defaultReserveReader(ctx: PromptContext): number | undefined {
  return readAutoCompactReserveTokens(ctx as unknown as ExtensionCommandContext);
}

/** Ordered safety gates. A rejection never consumes the one probe attempt. */
export async function checkProbeStartConditions(
  ctx: PromptContext,
  deps: ContextViewDependencies & { compaction: CompactionState },
): Promise<'ok' | string> {
  if (deps.autoProbing === false) return 'automatic probing is disabled';
  if (!canPresent(ctx)) return 'TUI presentation is unavailable';
  try {
    if (ctx.waitForIdle) await ctx.waitForIdle();
    else if (!ctx.isIdle()) return 'the agent is not idle and waiting for idle is unavailable';
  } catch {
    return 'waiting for idle failed';
  }
  if (deps.compaction.isActive) return 'context compaction is in progress';
  if (ctx.hasPendingMessages()) return 'queued input is pending';
  if (!ctx.model) return 'no model is selected';
  if (ctx.model.api === VIRTUAL_MODEL_API) return 'a virtual model is selected';
  if (!ctx.modelRegistry.hasConfiguredAuth(ctx.model)) return `${ctx.model.provider} has no configured authentication`;
  try {
    const settings = deps.readProbeSettings?.(ctx) ?? SettingsManager.create(ctx.cwd, undefined, { projectTrusted: ctx.isProjectTrusted() });
    if (settings.drainErrors?.().length) return 'settings unreadable';
    if (settings.getCacheWarmingMode() === 'idle') return 'idle cache warming is enabled';
    const compactionSettings = settings.getCompactionSettings(ctx.model);
    const usage = ctx.getContextUsage();
    if (usage?.tokens !== null && usage?.tokens !== undefined && shouldCompact(usage.tokens, usage.contextWindow, compactionSettings)) {
      return 'usage is at the auto-compaction threshold';
    }
  } catch {
    return 'settings unreadable';
  }
  return 'ok';
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

  // Frozen snapshots open immediately; only probing requires an idle session.
  if (!initial) {
    const condition = await checkProbeStartConditions(ctx, { ...dependencies, compaction });
    initial = capture.snapshot;
    // A real turn may have supplied the snapshot during the idle wait.
    if (!initial && condition !== 'ok') {
      degradedReason = `Silent probe unavailable: ${condition}. Extension additions were not observed.`;
    } else if (!initial) {
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
