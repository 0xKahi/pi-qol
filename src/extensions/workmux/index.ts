import type { ExtensionAPI, ExtensionContext } from '@earendil-works/pi-coding-agent';
import type { ConfigLoader } from '../../config-loader';

type AssistantState = { stopReason?: string; errorMessage?: string };

export function registerWorkmux(pi: ExtensionAPI, deps: { config: ConfigLoader }) {
  let sessionActive = false;
  let writes = Promise.resolve();

  function setStatus(status: string) {
    writes = writes.then(async () => {
      await pi.exec('workmux', ['set-window-status', status]).catch(() => {});
    });
    return writes;
  }

  function latestAssistantWasAborted(ctx: ExtensionContext) {
    const branch = ctx.sessionManager.getBranch() as Array<{
      type?: string;
      message?: AssistantState & { role?: string };
    }>;
    for (let index = branch.length - 1; index >= 0; index--) {
      const entry = branch[index];
      if (entry?.type !== 'message' || entry.message?.role !== 'assistant') continue;
      return (
        entry.message.stopReason === 'aborted' ||
        (entry.message.stopReason === 'error' && /\boperation was aborted\b/i.test(entry.message.errorMessage ?? ''))
      );
    }
    return false;
  }

  pi.on('session_start', async () => {
    sessionActive = false;
    await writes;
    if (!deps.config.isEnabled('workmux')) return;
    await pi.exec('workmux', ['register-agent']).catch(() => {});
    sessionActive = true;
  });

  pi.on('agent_start', async () => {
    if (!sessionActive) return;
    await setStatus('working');
  });

  pi.on('agent_settled', async (_event, ctx) => {
    if (!sessionActive) return;
    if (latestAssistantWasAborted(ctx)) return;
    await setStatus('done');
  });

  pi.on('session_shutdown', async () => {
    sessionActive = false;
    await writes;
  });
}
