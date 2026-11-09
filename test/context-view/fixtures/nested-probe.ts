import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';

/** Simulates another extension sending a user message inside the probe input scope. */
export function registerNestedProbeSend(pi: ExtensionAPI): void {
  let sent = false;
  pi.on('input', event => {
    if (sent || event.source !== 'extension') return;
    sent = true;
    pi.sendUserMessage('Nested extension message');
  });
}
