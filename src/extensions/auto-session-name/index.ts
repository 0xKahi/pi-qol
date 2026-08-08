import type { ExtensionAPI, ExtensionContext } from '@earendil-works/pi-coding-agent';
import type { ConfigLoader } from '../../config-loader';
import { ModelResolver } from '../../utils/model-resolver.util';
// import { parseAgentContentToPrompt } from '../../utils/parse-agent-content.util';
import { AutoSessionNameGuard } from './guards';
import { AutoSessionNameTitleGenerator } from './title-generator';

export function registerAutoSessionName(pi: ExtensionAPI, deps: { config: ConfigLoader }) {
  let lastSessionStartReason: string | undefined;
  let titleController: AbortController | undefined;

  pi.on('session_start', (event, _ctx) => {
    lastSessionStartReason = event.reason;
  });

  pi.on('session_shutdown', () => {
    titleController?.abort();
    titleController = undefined;
  });

  const setAutoSessionName = (ctx: ExtensionContext, text: string) => {
    const cfg = deps.config.getAutoSessionName();
    const configModel = cfg.enabled ? cfg.model : undefined;

    titleController?.abort();
    titleController = new AbortController();
    const signal = titleController.signal;

    void (async () => {
      const resolved = await new ModelResolver(ctx).resolveModel(configModel);
      if (resolved.error) {
        ctx.ui.notify(resolved.error, 'warning');
      }
      if (!resolved.result) return;

      const result = await AutoSessionNameTitleGenerator.generateAndApplyTitle({
        pi,
        userText: text,
        resolvedModel: {
          ...resolved.result,
          reasoning: resolved.result.reasoning ?? 'minimal',
        },
        signal,
      });

      if (result.error) {
        ctx.ui.notify(`(pi-qol) auto_session_name: ${result.error}`, 'warning');
        return;
      }

      if (!result.text) {
        ctx.ui.notify('(pi-qol) auto_session_name: no title was generated', 'warning');
        return;
      }

      const appliedTitle = pi.getSessionName();
      if (appliedTitle !== result.text) {
        ctx.ui.notify(`(pi-qol) auto_session_name generated but not applied: ${result.text}`, 'warning');
        return;
      }

      ctx.ui.notify(`(pi-qol) session renamed  : ${result.text}  `, 'info');
    })().catch(err => {
      ctx.ui.notify(`(pi-qol) auto_session_name: ${JSON.stringify(err)}`, 'error');
    });
  };

  pi.on('before_agent_start', (event, ctx) => {
    if (!deps.config.isEnabled('auto_session_name')) return;
    if (AutoSessionNameGuard.isSessionNameSet(pi)) return;
    if (AutoSessionNameGuard.isChildSession({ startReason: lastSessionStartReason, manager: ctx.sessionManager })) return;
    if (!AutoSessionNameGuard.isUsersFirstTurn(ctx.sessionManager)) return;

    const userText = event.prompt?.trim();
    if (!userText) return;

    setAutoSessionName(ctx, userText);
  });

  // need fixing, currently does not work
  // pi.on('message_start', (event, ctx) => {
  //   // ctx.ui.notify('hello0', 'info');
  //   if (!deps.config.isEnabled('auto_session_name')) return;
  //   const whitelist = new Set(deps.config.getAutoSessionName().customMessageWhitelist);
  //   // ctx.ui.notify(JSON.stringify(deps.config.getAutoSessionName()), 'warning');
  //   if (whitelist.size === 0) return;
  //   // ctx.ui.notify('hello1', 'info');
  //   const message = event.message;
  //   if (message.role !== 'custom' || !whitelist.has(message.customType)) {
  //     return;
  //   }
  //
  //   ctx.ui.notify('hello2', 'info');
  //   if (AutoSessionNameGuard.isSessionNameSet(pi)) return;
  //   ctx.ui.notify('hello3', 'info');
  //   if (AutoSessionNameGuard.isChildSession({ startReason: lastSessionStartReason, manager: ctx.sessionManager })) return;
  //   ctx.ui.notify('hello4', 'info');
  //   if (!AutoSessionNameGuard.isFirstCustomExtensionMessage(ctx.sessionManager, whitelist)) return;
  //   ctx.ui.notify('hello5', 'info');
  //   const prompt = parseAgentContentToPrompt(message.content);
  //   ctx.ui.notify(prompt, 'info');
  //   if (!prompt) return;
  //   setAutoSessionName(ctx, prompt);
  // });
}
