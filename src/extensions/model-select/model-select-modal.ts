import type { KeybindingsManager, Theme } from '@earendil-works/pi-coding-agent';
import type { TUI } from '@earendil-works/pi-tui';
import { SectionedModal, type SectionFrame } from '../../libs/modal';
import type { SubscriptionUsageCache } from '../../libs/subscription-usage';
import { createSelectModelSection } from './model-select-dialog';
import type { DialogOptions, DialogResult } from './types';
import { createUsageSection } from './usage-section';

function scheduleTick(callback: () => void, intervalMs: number): () => void {
  const timer = setInterval(callback, intervalMs);
  timer.unref?.();
  return () => clearInterval(timer);
}

export class ModelSelectModal extends SectionedModal<DialogResult> {
  private readonly cleanup: () => void;

  public constructor(
    tui: TUI,
    theme: Theme,
    keybindings: KeybindingsManager,
    options: DialogOptions & {
      frame: SectionFrame;
      usageCache: SubscriptionUsageCache;
      now?: () => number;
      scheduleTick?: (callback: () => void, intervalMs: number) => () => void;
    },
  ) {
    let disposed = false;
    let unsubscribe: () => void = () => undefined;
    let cancelTick: () => void = () => undefined;
    const cleanup = () => {
      if (disposed) return;
      disposed = true;
      cancelTick();
      unsubscribe();
    };
    const onDone = (result: DialogResult) => {
      cleanup();
      options.onDone(result);
    };
    super(tui, theme, {
      frame: options.frame,
      sections: [
        { label: 'Select Model', dialog: createSelectModelSection(tui, theme, keybindings, { ...options, onDone }) },
        createUsageSection(tui, theme, keybindings, {
          cache: options.usageCache,
          currentProvider: options.currentModel?.provider,
          onDone,
          now: options.now,
        }),
      ],
    });
    this.cleanup = cleanup;
    unsubscribe = options.usageCache.subscribe(() => {
      if (!disposed) tui.requestRender();
    });
    cancelTick = (options.scheduleTick ?? scheduleTick)(() => {
      if (!disposed && this.activeSectionIndex === 1) tui.requestRender();
    }, 1000);
  }

  public dispose(): void {
    this.cleanup();
  }
}
