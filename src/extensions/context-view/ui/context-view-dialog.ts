import type { KeybindingsManager, Theme } from '@earendil-works/pi-coding-agent';
import type { Component, Focusable, TUI, TuiMouseEvent, TuiMouseEventResult } from '@earendil-works/pi-tui';
import { ModalDialog, type ModalFrame, VimNavigationScheme } from '../../../libs/modal';
import type { ContextUsageSnapshot, InitialSnapshot } from '../model';
import type { Clipboard, CopyServices } from './copy';
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
    clipboard?: Clipboard,
  ) {
    // Views report copy results through the dialog's footer notice; the
    // dialog is assigned below, before any view can handle input.
    const copy: CopyServices = {
      notices: { showNotice: (text, tone, ttlMs) => this.dialog.showNotice(text, tone, ttlMs) },
      clipboard,
    };
    this.dialog = new ModalDialog<undefined>(tui, theme, keybindings, {
      tabs: [new UsageView(theme, { usage: input.usage }, copy), new InjectionsView(theme, { snapshot: input.initial }, copy)],
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

  handleMouse(event: TuiMouseEvent): TuiMouseEventResult | undefined {
    return this.dialog.handleMouse(event);
  }

  render(width: number): string[] {
    return this.dialog.render(width);
  }
}
