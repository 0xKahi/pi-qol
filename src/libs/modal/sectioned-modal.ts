import type { Theme } from '@earendil-works/pi-coding-agent';
import { type Component, type Focusable, matchesKey, type TUI } from '@earendil-works/pi-tui';
import type { ModalDialog } from './modal-dialog';
import { renderSectionRule } from './section-strip';
import { padLine } from './text';

export type SectionFrame = 'inline' | 'bordered';

export interface ModalSection<TResult> {
  label: string;
  dialog: ModalDialog<TResult>;
  onActivate?: () => void;
}

/** Frame and section routing around retained, caller-wired embedded dialogs. */
export class SectionedModal<TResult> implements Component, Focusable {
  private readonly activated = new Set<number>();
  private readonly frame: SectionFrame;
  private activeIndex: number;
  private _focused = false;

  public constructor(
    private readonly tui: TUI,
    private readonly theme: Theme,
    private readonly options: { sections: ModalSection<TResult>[]; frame?: SectionFrame; initialSectionIndex?: number },
  ) {
    if (options.sections.length === 0) throw new Error('SectionedModal requires at least one section');
    this.frame = options.frame ?? 'inline';
    this.activeIndex = Math.min(Math.max(0, options.initialSectionIndex ?? 0), options.sections.length - 1);
    for (const section of options.sections) {
      section.dialog.focused = false;
      if (options.sections.length > 1) section.dialog.setExtraHints([['^]/^[', 'Section']]);
    }
    this.activate();
  }

  public get activeSectionIndex(): number {
    return this.activeIndex;
  }

  public get focused(): boolean {
    return this._focused;
  }

  public set focused(value: boolean) {
    this._focused = value;
    for (const [index, section] of this.options.sections.entries()) section.dialog.focused = value && index === this.activeIndex;
  }

  public handleInput(data: string): void {
    if (matchesKey(data, 'ctrl+]')) {
      this.switchSection(1);
    } else if (data !== '\x1b' && matchesKey(data, 'ctrl+[')) {
      this.switchSection(-1);
    } else {
      this.activeDialog().handleInput(data);
    }
  }

  public render(width: number): string[] {
    const safeWidth = Math.max(3, width);
    const bordered = this.frame === 'bordered';
    const inner = safeWidth - (bordered ? 2 : 0);
    const lines = this.activeDialog().render(inner);
    const border = (text: string) => this.theme.fg('border', text);
    const top = renderSectionRule(
      this.theme,
      this.options.sections.map(section => section.label),
      this.activeIndex,
      safeWidth,
      this.frame,
    );
    if (bordered) {
      const side = border('│');
      return [top, ...lines.map(line => `${side}${padLine(line, inner)}${side}`), border(`╰${'─'.repeat(inner)}╯`)];
    }
    return [top, ...lines, border('─'.repeat(safeWidth))];
  }

  public invalidate(): void {
    for (const section of this.options.sections) section.dialog.invalidate();
  }

  private activeDialog(): ModalDialog<TResult> {
    const section = this.options.sections[this.activeIndex];
    if (section === undefined) throw new Error('SectionedModal requires at least one section');
    return section.dialog;
  }

  private switchSection(direction: -1 | 1): void {
    const count = this.options.sections.length;
    if (count === 1) return;
    this.activeDialog().resetNavigation();
    this.activeIndex = (this.activeIndex + direction + count) % count;
    this.focused = this._focused;
    this.activate();
    this.tui.requestRender();
  }

  private activate(): void {
    if (this.activated.has(this.activeIndex)) return;
    this.activated.add(this.activeIndex);
    this.options.sections[this.activeIndex]?.onActivate?.();
  }
}
