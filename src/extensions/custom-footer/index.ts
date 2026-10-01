import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import type { ConfigLoader } from '../../config-loader';
import { SET_AGENT_NAME_EVENT_ID } from '../../constants';
import type { SubscriptionUsageCache } from '../../libs/subscription-usage';
import { AgentDisplayState } from './agent-display-state';
import { CustomFooterComponent } from './footer-component';

export function registerCustomFooter(pi: ExtensionAPI, deps: { config: ConfigLoader; usageCache: SubscriptionUsageCache }): void {
  let installed = false;
  const agentDisplayState = new AgentDisplayState('DEFAULT');

  pi.events.on(SET_AGENT_NAME_EVENT_ID, payload => {
    agentDisplayState.update(payload);
  });

  pi.on('session_start', (_event, ctx) => {
    agentDisplayState.reset(deps.config.getCustomFooter().defaultAgentName);
    if (!deps.config.isEnabled('custom_footer')) return;
    if (installed) return;

    ctx.ui.setFooter(
      (tui, theme, footerData) =>
        new CustomFooterComponent({
          tui,
          theme,
          footerData,
          ctx,
          config: deps.config,
          usageCache: deps.usageCache,
          agentDisplayState,
          getThinkingLevel: () => pi.getThinkingLevel(),
        }),
    );
    installed = true;
  });
}
