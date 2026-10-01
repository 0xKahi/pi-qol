import type { ExtensionAPI, ExtensionContext } from '@earendil-works/pi-coding-agent';
import { ConfigLoader } from './config-loader';
import { registerAutoSessionName } from './extensions/auto-session-name';
import { registerContextView } from './extensions/context-view';
import { registerCustomFooter } from './extensions/custom-footer';
import { registerModelSelect } from './extensions/model-select';
import { registerWorkmux } from './extensions/workmux';
import { createHostCredentialResolver, SubscriptionUsageApi, SubscriptionUsageCache } from './libs/subscription-usage';

export default function (pi: ExtensionAPI) {
  const config = new ConfigLoader();
  let latestCtx: ExtensionContext | undefined;
  const usageCache = new SubscriptionUsageCache({ api: new SubscriptionUsageApi(createHostCredentialResolver(() => latestCtx)) });

  pi.on('session_start', (_event, ctx) => {
    latestCtx = ctx;
    const { error } = config.initializeConfig(ctx);
    if (error) ctx.ui.notify(error, 'error');
  });

  registerAutoSessionName(pi, { config });
  registerModelSelect(pi, { config, usageCache });
  registerCustomFooter(pi, { config, usageCache });
  registerContextView(pi, { config });
  registerWorkmux(pi, { config });
}
