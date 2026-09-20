import { buildSessionContext, type ExtensionAPI, type ExtensionContext } from '@earendil-works/pi-coding-agent';
import type { ConfigLoader } from '../../config-loader';
import { presentModal } from '../../libs/modal';
import {
  CompactionState,
  collectPromptSources,
  InitialCaptureState,
  PROBE_IDENTITIES_CUSTOM_TYPE,
  parsePersistedIdentities,
  SilentProbeState,
} from './capture';
import { COMMAND_NAME, PI_VIM_KEY_EVENT_ID } from './constants';
import { prepareContextViewData } from './context-view-controller';
import { readProbeToken } from './probe-token';
import { ContextViewDialog } from './ui/context-view-dialog';

function activateContextView(pi: ExtensionAPI, deps: { config: ConfigLoader; initialCtx: ExtensionContext }): void {
  const capture = new InitialCaptureState();
  const probe = new SilentProbeState();
  const compaction = new CompactionState();
  let persistedIdentityCount = 0;
  let latestCtx: ExtensionContext = deps.initialCtx;
  const enabled = () => deps.config.isEnabled('context_view');

  const restoreProbeIdentities = (ctx: ExtensionContext) => {
    for (const entry of ctx.sessionManager.getEntries()) {
      if (entry.type === 'custom' && entry.customType === PROBE_IDENTITIES_CUSTOM_TYPE) {
        probe.restoreIdentities(parsePersistedIdentities(entry.data));
      }
    }
    persistedIdentityCount = probe.syntheticMessages.length;
  };
  const persistProbeIdentities = () => {
    const identities = probe.syntheticMessages;
    if (identities.length <= persistedIdentityCount) return;
    pi.appendEntry(PROBE_IDENTITIES_CUSTOM_TYPE, { messages: identities });
    persistedIdentityCount = identities.length;
  };
  const openContextView = async (ctx: ExtensionContext) => {
    const data = await prepareContextViewData(pi, ctx, capture, probe, compaction);
    const config = deps.config.getContextView();
    await presentModal(
      ctx.ui,
      config.layout,
      (tui, theme, keybindings, done, frame) => new ContextViewDialog(tui, theme, keybindings, data, done, frame),
    );
  };

  restoreProbeIdentities(deps.initialCtx);
  pi.on('session_start', (_event, ctx) => {
    latestCtx = ctx;
    compaction.finish();
    if (enabled()) restoreProbeIdentities(ctx);
  });
  pi.on('session_before_compact', event => {
    if (enabled()) compaction.begin(event.signal);
  });
  pi.on('session_compact', () => compaction.finish());
  pi.on('session_compact_failed', () => compaction.finish());
  pi.on('input', event => {
    if (!enabled()) return;
    // Reset text earlier input transforms added to our own synthetic prompt:
    // the probe carries no instructions, and its run is identified by token.
    if (event.text === '' || !probe.isProbeInput(event.source, readProbeToken())) return undefined;
    return { action: 'transform', text: '' } as const;
  });
  pi.on('before_agent_start', event => {
    if (!enabled()) return;
    probe.beginRun(readProbeToken());
    // The chained prompt here already carries additions from extensions loaded
    // earlier; anything the context event adds came from extensions after us.
    capture.prepare(event.systemPromptOptions, event.systemPrompt);
  });
  pi.on('turn_start', (_event, ctx) => {
    if (enabled() && probe.isCurrentRun) ctx.abort();
  });
  pi.on('message_start', event => {
    if (enabled()) probe.recordMessage(event.message);
  });
  pi.on('message_end', event => {
    if (!enabled()) return;
    const message = probe.sanitizeMessage(event.message);
    return message === undefined ? undefined : { message };
  });
  pi.on('context', (event, ctx) => {
    if (!enabled()) return;
    const messages = probe.filterMessages(event.messages);
    capture.finalize(() => ({
      systemPrompt: ctx.getSystemPrompt(),
      messages,
      baselineMessages: probe.filterMessages(buildSessionContext(ctx.sessionManager.getEntries(), ctx.sessionManager.getLeafId()).messages),
      allTools: pi.getAllTools(),
      activeToolNames: pi.getActiveTools(),
      promptSources: collectPromptSources(pi.getAllTools(), pi.getCommands()),
      origin: probe.isCurrentRun ? 'synthetic-probe' : 'real-turn',
    }));
    return messages === event.messages ? undefined : { messages };
  });
  pi.on('agent_settled', (_event, ctx) => {
    if (!enabled() || !probe.isCurrentRun) return;
    if (ctx.mode === 'tui') ctx.ui.setWorkingVisible(true);
    probe.settle(capture.snapshot !== undefined);
    persistProbeIdentities();
  });
  pi.on('session_shutdown', () => {
    compaction.finish();
    // Once activated, cleanup runs even if config reloaded to disabled: the
    // probe may already have written messages this runtime must identify.
    persistProbeIdentities();
    probe.fail('Session ended before the silent probe completed.');
  });

  pi.registerCommand(COMMAND_NAME, {
    description: 'Inspect model context usage and injections',
    handler: async (args, ctx) => {
      latestCtx = ctx;
      if (!enabled()) {
        ctx.ui.notify('(pi-qol) context_view is disabled', 'warning');
        return;
      }
      if (args.trim()) {
        ctx.ui.notify('/context-view accepts no arguments.', 'error');
        return;
      }
      if (ctx.mode !== 'tui') {
        ctx.ui.notify('/context-view requires TUI mode.', 'warning');
        return;
      }
      await openContextView(ctx);
    },
  });

  pi.events.on(PI_VIM_KEY_EVENT_ID, () => {
    if (!enabled() || latestCtx.mode !== 'tui') return;
    void openContextView(latestCtx).catch(error => {
      latestCtx.ui.notify(`Failed to open Context View: ${error instanceof Error ? error.message : String(error)}`, 'error');
    });
  });
}

/** Lazily registers Context View only after an enabled session starts. */
export function registerContextView(pi: ExtensionAPI, deps: { config: ConfigLoader }): void {
  let registered = false;
  pi.on('session_start', (_event, ctx) => {
    if (registered || !deps.config.isEnabled('context_view')) return;
    activateContextView(pi, { config: deps.config, initialCtx: ctx });
    registered = true;
  });
}
