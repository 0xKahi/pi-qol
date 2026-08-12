import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import type { ConfigLoader } from '../../config-loader';

export function activateWorkmux(pi: ExtensionAPI) {
  function setStatus(status: string) {
    pi.exec('workmux', ['set-window-status', status]).catch(() => {});
  }

  pi.on('session_start', async () => {
    setStatus('waiting');
  });

  pi.on('agent_start', async () => {
    setStatus('working');
  });

  pi.on('agent_end', async () => {
    setStatus('done');
  });
}

export function registerWorkmux(pi: ExtensionAPI, deps: { config: ConfigLoader }) {
  let registered = false;
  pi.on('session_start', (_event, _ctx) => {
    if (registered || !deps.config.isEnabled('workmux')) return;
    activateWorkmux(pi);
    registered = true;
  });
}
