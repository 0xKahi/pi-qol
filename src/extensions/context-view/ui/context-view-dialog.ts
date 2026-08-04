import type { KeybindingsManager, Theme } from '@earendil-works/pi-coding-agent';
import type { Component, Focusable, TUI } from '@earendil-works/pi-tui';
import { ModalDialog, type ModalFrame, VimNavigationScheme } from '../../../libs/modal';
import type { ContextUsageSnapshot, InitialSnapshot } from '../model';
import { InjectionsView } from './injections-view';
import { UsageView } from './usage-view';

export type ContextViewTab = 'usage' | 'injections';

export interface ContextViewDialogInput {
  usage: ContextUsageSnapshot;
  initial: InitialSnapshot;
  degradedReason?: string;
}

/**
 * Bounded half-height Context View shell: a `ModalDialog` configured with
 * Vim navigation, the Usage and Injections tabs, and the degraded-capture
 * notice. Both tab instances are retained so each preserves its scroll,
 * selection, zoom, and preview-layer state across tab switches.
 */
export class ContextViewDialog implements Component, Focusable {
  private readonly dialog: ModalDialog<undefined>;

  constructor(
    tui: TUI,
    theme: Theme,
    keybindings: KeybindingsManager,
    input: ContextViewDialogInput,
    done: (result: undefined) => void,
    frame: ModalFrame = 'inline',
  ) {
    this.dialog = new ModalDialog<undefined>(tui, theme, keybindings, {
      tabs: [new UsageView(theme, { usage: input.usage }), new InjectionsView(theme, { snapshot: input.initial })],
      navigation: new VimNavigationScheme(),
      frame,
      height: 'half',
      notices: input.degradedReason === undefined ? [] : [input.degradedReason],
      cancelValue: undefined,
      onComplete: done,
    });
  }

  get focused(): boolean {
    return this.dialog.focused;
  }

  set focused(value: boolean) {
    this.dialog.focused = value;
  }

  get activeTab(): ContextViewTab {
    return this.dialog.activeIndex === 0 ? 'usage' : 'injections';
  }

  invalidate(): void {
    this.dialog.invalidate();
  }

  handleInput(data: string): void {
    this.dialog.handleInput(data);
  }

  render(width: number): string[] {
    return this.dialog.render(width);
  }
}
