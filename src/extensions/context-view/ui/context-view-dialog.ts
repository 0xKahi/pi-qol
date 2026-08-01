import type { KeybindingsManager, Theme } from '@earendil-works/pi-coding-agent';
import { type Component, type Focusable, Key, matchesKey, type TUI, truncateToWidth } from '@earendil-works/pi-tui';
import type { ContextUsageSnapshot, InitialSnapshot } from '../model';
import { InjectionsView } from './injections-view';
import { VimNavigation } from './navigation';
import { UsageView } from './usage-view';

export type ContextViewTab = 'usage' | 'injections';

/** One half-height Context View shell that retains both child-tab states. */
export class ContextViewDialog implements Component, Focusable {
  private readonly usage: UsageView;
  private readonly injections: InjectionsView;
  private readonly navigation = new VimNavigation();
  private active: ContextViewTab = 'usage';
  private _focused = false;

  constructor(
    private readonly tui: TUI,
    private readonly theme: Theme,
    _keybindings: KeybindingsManager,
    input: { usage: ContextUsageSnapshot; initial: InitialSnapshot; degradedReason?: string },
    done: (result: undefined) => void,
  ) {
    const getRows = () => Math.max(1, Math.floor(tui.terminal.rows / 2) - 1);
    this.usage = new UsageView(this.theme, { usage: input.usage, degradedReason: input.degradedReason }, done, getRows);
    this.injections = new InjectionsView(this.theme, { snapshot: input.initial, degradedReason: input.degradedReason }, done, getRows);
  }

  get focused(): boolean {
    return this._focused;
  }

  get activeTab(): ContextViewTab {
    return this.active;
  }

  set focused(value: boolean) {
    this._focused = value;
  }

  invalidate(): void {
    this.usage.invalidate();
    this.injections.invalidate();
  }

  handleInput(data: string): void {
    if (matchesKey(data, Key.tab)) {
      this.switchTab(1);
    } else if (matchesKey(data, Key.shift('tab'))) {
      this.switchTab(-1);
    } else {
      const navigation = this.navigation.consume(data);
      if (navigation.action) this.child().handleNavigation(navigation.action);
      else if (!navigation.handled) this.child().handleInput(data);
    }
    this.tui.requestRender();
  }

  render(width: number): string[] {
    const lines = this.child().render(width);
    const tabLine = this.renderTabs(width);
    return lines.length === 0 ? [tabLine] : [lines[0] ?? '', tabLine, ...lines.slice(1)];
  }

  private switchTab(_direction: -1 | 1): void {
    this.active = this.active === 'usage' ? 'injections' : 'usage';
    this.navigation.reset();
  }

  private renderTabs(width: number): string {
    const usage = this.active === 'usage' ? this.theme.fg('accent', this.theme.bold('[Usage]')) : this.theme.fg('muted', '[Usage]');
    const injections =
      this.active === 'injections' ? this.theme.fg('accent', this.theme.bold('[Injections]')) : this.theme.fg('muted', '[Injections]');
    return truncateToWidth(`  ${usage} ${injections}`, Math.max(1, width), '');
  }

  private child(): UsageView | InjectionsView {
    return this.active === 'usage' ? this.usage : this.injections;
  }
}
