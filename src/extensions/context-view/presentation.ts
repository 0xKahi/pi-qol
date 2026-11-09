import type { ExtensionContext } from '@earendil-works/pi-coding-agent';

/** Context View only captures and probes where it can actually be displayed. */
export function canPresent(ctx: Pick<ExtensionContext, 'mode' | 'hasUI'>): boolean {
  return ctx.mode === 'tui' && ctx.hasUI;
}
