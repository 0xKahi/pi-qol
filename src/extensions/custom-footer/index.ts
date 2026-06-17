import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import type { ConfigLoader } from '../../config-loader';
import { CustomFooterComponent } from './footer-component';

export function registerCustomFooter(pi: ExtensionAPI, deps: { config: ConfigLoader }): void {
  let installed = false;

  pi.on('session_start', (_event, ctx) => {
    if (!deps.config.isEnabled('custom_footer')) return;
    if (installed) return;

    ctx.ui.setFooter(
      (tui, theme, footerData) =>
        new CustomFooterComponent({ tui, theme, footerData, ctx, config: deps.config, getThinkingLevel: () => pi.getThinkingLevel() }),
    );
    installed = true;
  });
}
