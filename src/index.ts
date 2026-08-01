import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import { ConfigLoader } from './config-loader';
import { registerAutoSessionName } from './extensions/auto-session-name';
import { registerContextView } from './extensions/context-view';
import { registerCustomFooter } from './extensions/custom-footer';
import { registerModelSelect } from './extensions/model-select';

export default function (pi: ExtensionAPI) {
  const config = new ConfigLoader();

  pi.on('session_start', (_event, ctx) => {
    const { error } = config.initializeConfig(ctx);
    if (error) ctx.ui.notify(error, 'error');
  });

  registerAutoSessionName(pi, { config });
  registerModelSelect(pi, { config });
  registerCustomFooter(pi, { config });
  registerContextView(pi, { config });
}
