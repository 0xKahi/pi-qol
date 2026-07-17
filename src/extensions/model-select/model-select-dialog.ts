import { modelsAreEqual } from '@earendil-works/pi-ai';
import type { KeybindingsManager, Theme } from '@earendil-works/pi-coding-agent';
import { type Component, type Focusable, fuzzyFilter, Input, matchesKey, type TUI, truncateToWidth, visibleWidth } from '@earendil-works/pi-tui';
import { MAX_CONFIG_WARNING_LINES, MAX_VISIBLE_MODELS } from './constants';
import { ModelFormatter } from './model-formatter';
import type { DialogOptions, ModelItem, TabIdentity } from './types';

type DialogTab = {
  identity: TabIdentity;
  label: string;
  items: ModelItem[];
  filteredItems: ModelItem[];
  selectedIndex: number;
};

export class ModelSelectDialog implements Component, Focusable {
  private readonly searchInput = new Input();
  private readonly tabs: DialogTab[];
  private activeTabIndex: number;
  private _focused = false;

  constructor(
    private readonly tui: TUI,
    private readonly theme: Theme,
    private readonly keybindings: KeybindingsManager,
    private readonly options: DialogOptions,
  ) {
    this.tabs = this.createTabs();
    const searchTabIndex = this.tabs.findIndex(tab => tab.identity.kind === 'search');
    this.activeTabIndex = options.initialSearch && searchTabIndex >= 0 ? searchTabIndex : 0;

    this.searchInput.setValue(options.initialSearch);
    this.searchInput.onSubmit = () => this.selectCurrentItem();
    this.searchInput.onEscape = () => this.options.onDone(null);
    this.applyFilter(options.initialSearch);
    this.syncFocus();
  }

  get focused(): boolean {
    return this._focused;
  }

  set focused(value: boolean) {
    this._focused = value;
    this.syncFocus();
  }

  invalidate(): void {
    this.searchInput.invalidate();
  }

  handleInput(data: string): void {
    if (matchesKey(data, 'shift+tab')) {
      this.switchTab(-1);
      this.tui.requestRender();
      return;
    }

    if (this.keybindings.matches(data, 'tui.input.tab')) {
      this.switchTab(1);
      this.tui.requestRender();
      return;
    }

    if (this.keybindings.matches(data, 'tui.select.cancel')) {
      this.options.onDone(null);
      return;
    }

    if (this.keybindings.matches(data, 'tui.select.up')) {
      this.moveSelection(-1);
      this.tui.requestRender();
      return;
    }

    if (this.keybindings.matches(data, 'tui.select.down')) {
      this.moveSelection(1);
      this.tui.requestRender();
      return;
    }

    if (this.keybindings.matches(data, 'tui.select.pageUp')) {
      this.moveSelection(-MAX_VISIBLE_MODELS);
      this.tui.requestRender();
      return;
    }

    if (this.keybindings.matches(data, 'tui.select.pageDown')) {
      this.moveSelection(MAX_VISIBLE_MODELS);
      this.tui.requestRender();
      return;
    }

    if (this.keybindings.matches(data, 'tui.select.confirm')) {
      this.selectCurrentItem();
      return;
    }

    this.searchInput.handleInput(data);
    this.applyFilter(this.searchInput.getValue());
    this.tui.requestRender();
  }

  render(width: number): string[] {
    const safeWidth = Math.max(3, width);

    if (this.options.layout === 'inline') {
      const lines = this.buildContentLines(safeWidth);
      const rule = this.theme.fg('border', '─'.repeat(safeWidth));
      return [rule, ...lines.map(line => this.padLine(line, safeWidth)), rule];
    }

    const inner = safeWidth - 2;
    const lines = this.buildContentLines(inner);
    const borderColor = (str: string) => this.theme.fg('border', str);
    const horizontal = '─'.repeat(inner);
    const side = borderColor('│');

    return [borderColor(`╭${horizontal}╮`), ...lines.map(line => `${side}${this.padLine(line, inner)}${side}`), borderColor(`╰${horizontal}╯`)];
  }

  private createTabs(): DialogTab[] {
    const definitions: Array<{ identity: TabIdentity; label: string; items: ModelItem[] }> = [
      { identity: { kind: 'favourites' }, label: this.options.favouriteLabel, items: this.options.favouriteItems },
    ];

    if (!this.options.hideGroupTabs) {
      definitions.push(
        ...this.options.groupLists.map(group => ({
          identity: { kind: 'group', name: group.name } as const,
          label: group.name,
          items: group.items,
        })),
      );
    }

    if (!this.options.hideSearchTab) {
      definitions.push({ identity: { kind: 'search' }, label: 'Search', items: this.options.searchItems });
    }

    return definitions.map(definition => {
      const currentIndex = this.options.currentModel ? definition.items.findIndex(item => modelsAreEqual(item.model, this.options.currentModel)) : -1;
      return {
        ...definition,
        filteredItems: definition.items,
        selectedIndex: currentIndex >= 0 ? currentIndex : 0,
      };
    });
  }

  private applyFilter(query: string): void {
    for (const tab of this.tabs) {
      tab.filteredItems = this.filterItems(tab.items, query);
      tab.selectedIndex = Math.min(tab.selectedIndex, Math.max(0, tab.filteredItems.length - 1));
    }
  }

  private buildContentLines(inner: number): string[] {
    const lines: string[] = [this.line(this.renderTitle(), inner), this.renderTabs(inner)];

    for (const warning of this.options.configWarnings.slice(0, MAX_CONFIG_WARNING_LINES)) {
      lines.push(this.line(this.theme.fg('warning', `⚠ ${warning}`), inner));
    }
    if (this.options.configWarnings.length > MAX_CONFIG_WARNING_LINES) {
      lines.push(
        this.line(this.theme.fg('warning', `⚠ ${this.options.configWarnings.length - MAX_CONFIG_WARNING_LINES} more config warning(s)`), inner),
      );
    }

    lines.push('', ...this.renderActiveTab(inner), '', this.line(this.renderHelp(), inner));
    return lines;
  }

  private padLine(text: string, innerWidth: number): string {
    const truncated = truncateToWidth(text.replace(/[\r\n]+/g, ' '), innerWidth, '');
    return truncated + ' '.repeat(Math.max(0, innerWidth - visibleWidth(truncated)));
  }

  private switchTab(direction: -1 | 1): void {
    this.activeTabIndex = this.wrapIndex(this.activeTabIndex + direction, this.tabs.length);
    this.syncFocus();
  }

  private syncFocus(): void {
    this.searchInput.focused = this._focused;
  }

  private moveSelection(delta: number): void {
    const tab = this.activeTab();
    tab.selectedIndex = this.wrapIndex(tab.selectedIndex + delta, tab.filteredItems.length);
  }

  private wrapIndex(index: number, length: number): number {
    return length <= 0 ? 0 : ((index % length) + length) % length;
  }

  private selectCurrentItem(): void {
    const tab = this.activeTab();
    const item = tab.filteredItems[tab.selectedIndex];
    if (item) {
      this.options.onDone(item.model);
    }
  }

  private activeTab(): DialogTab {
    const tab = this.tabs[this.activeTabIndex];
    if (!tab) {
      throw new Error('Model selector requires at least the Favourites tab');
    }
    return tab;
  }

  private filterItems(items: ModelItem[], query: string): ModelItem[] {
    const trimmed = query.trim();
    return trimmed ? fuzzyFilter(items, trimmed, item => item.searchText) : items;
  }

  private renderTitle(): string {
    const current = this.options.currentModel ? ModelFormatter.modelLabel(this.options.currentModel) : 'none';
    return `${this.theme.fg('customMessageLabel', this.theme.bold('Select Model'))} ${this.theme.fg('muted', `current: ${current}`)}`;
  }

  private renderTabs(width: number): string {
    const labels = this.tabs.map(tab => `[${tab.label} ${tab.filteredItems.length}]`);
    const separator = '  ';
    if (visibleWidth(labels.join(separator)) <= width) {
      return this.styleTabLabels(labels, 0, labels.length - 1, false, false);
    }

    let start = this.activeTabIndex;
    let end = this.activeTabIndex;
    let expandLeft = true;
    while (true) {
      const nextStart = expandLeft && start > 0 ? start - 1 : start;
      const nextEnd = !expandLeft && end < labels.length - 1 ? end + 1 : end;
      expandLeft = !expandLeft;

      if (nextStart === start && nextEnd === end) {
        if ((start === 0 || nextStart === start) && (end === labels.length - 1 || nextEnd === end)) break;
        continue;
      }

      const candidate = this.plainTabViewport(labels, nextStart, nextEnd);
      if (visibleWidth(candidate) <= width) {
        start = nextStart;
        end = nextEnd;
        continue;
      }

      const otherStart = start > 0 ? start - 1 : start;
      const otherEnd = end < labels.length - 1 ? end + 1 : end;
      if ((otherStart === start && otherEnd === end) || visibleWidth(this.plainTabViewport(labels, otherStart, otherEnd)) > width) break;
      start = otherStart;
      end = otherEnd;
    }

    const leftOmitted = start > 0;
    const rightOmitted = end < labels.length - 1;
    const plain = this.plainTabViewport(labels, start, end);
    if (visibleWidth(plain) <= width) {
      return this.styleTabLabels(labels, start, end, leftOmitted, rightOmitted);
    }

    const prefix = leftOmitted ? '… ' : '';
    const suffix = rightOmitted ? ' …' : '';
    const activeBudget = Math.max(1, width - visibleWidth(prefix) - visibleWidth(suffix));
    const active = truncateToWidth(labels[this.activeTabIndex] ?? '', activeBudget, '');
    return this.line(`${this.theme.fg('muted', prefix)}${this.theme.fg('accent', this.theme.bold(active))}${this.theme.fg('muted', suffix)}`, width);
  }

  private plainTabViewport(labels: string[], start: number, end: number): string {
    const parts = labels.slice(start, end + 1);
    if (start > 0) parts.unshift('…');
    if (end < labels.length - 1) parts.push('…');
    return parts.join('  ');
  }

  private styleTabLabels(labels: string[], start: number, end: number, leftOmitted: boolean, rightOmitted: boolean): string {
    const parts: string[] = [];
    if (leftOmitted) parts.push(this.theme.fg('muted', '…'));
    for (let index = start; index <= end; index++) {
      const label = labels[index] ?? '';
      parts.push(index === this.activeTabIndex ? this.theme.fg('accent', this.theme.bold(label)) : this.theme.fg('muted', label));
    }
    if (rightOmitted) parts.push(this.theme.fg('muted', '…'));
    return parts.join(this.theme.fg('muted', '  '));
  }

  private renderActiveTab(width: number): string[] {
    const tab = this.activeTab();
    const lines: string[] = [];

    if (tab.identity.kind === 'search') {
      const providerText =
        this.options.providerFilter.length === 0 ? 'all authorized providers' : `providers: ${this.options.providerFilter.join(', ')}`;
      lines.push(this.line(this.theme.fg('muted', `Provider filter: ${providerText}`), width));
      lines.push(this.line(this.theme.fg('muted', 'Search query:'), width));
    } else {
      lines.push(this.line(this.theme.fg('muted', 'Filter:'), width));
    }
    lines.push(...this.searchInput.render(width), '');

    if (tab.items.length === 0) {
      lines.push(this.line(this.theme.fg('muted', this.emptyTabMessage(tab)), width));
    } else if (tab.filteredItems.length === 0) {
      lines.push(this.line(this.theme.fg('muted', `  No matching ${tab.identity.kind === 'search' ? 'models' : 'favourites'}`), width));
    } else {
      lines.push(...this.renderModelList(tab.filteredItems, tab.selectedIndex, width));
      const selected = tab.filteredItems[tab.selectedIndex];
      if (selected) {
        lines.push('', this.line(this.theme.fg('muted', `  ${selected.description}`), width));
      }
    }

    if (tab.identity.kind === 'favourites') {
      this.appendFavouriteWarnings(lines, width);
    }
    return lines;
  }

  private emptyTabMessage(tab: DialogTab): string {
    if (tab.identity.kind === 'favourites') return '  No configured favourites are available.';
    if (tab.identity.kind === 'group') return `  No available favourites in ${tab.label}.`;
    return '  No matching models';
  }

  private appendFavouriteWarnings(lines: string[], width: number): void {
    for (const warning of this.options.favouriteWarnings.slice(0, MAX_CONFIG_WARNING_LINES)) {
      lines.push(this.line(this.theme.fg('warning', `  ⚠ ${warning}`), width));
    }
    if (this.options.favouriteWarnings.length > MAX_CONFIG_WARNING_LINES) {
      lines.push(
        this.line(
          this.theme.fg('warning', `  ⚠ ${this.options.favouriteWarnings.length - MAX_CONFIG_WARNING_LINES} more favourite warning(s)`),
          width,
        ),
      );
    }
  }

  private renderModelList(items: ModelItem[], selectedIndex: number, width: number): string[] {
    const startIndex = Math.max(0, Math.min(selectedIndex - Math.floor(MAX_VISIBLE_MODELS / 2), items.length - MAX_VISIBLE_MODELS));
    const endIndex = Math.min(startIndex + MAX_VISIBLE_MODELS, items.length);
    const lines: string[] = [];

    for (let index = startIndex; index < endIndex; index++) {
      const item = items[index];
      if (item) lines.push(this.renderModelItem(item, index === selectedIndex, width));
    }
    if (startIndex > 0 || endIndex < items.length) {
      lines.push(this.line(this.theme.fg('dim', `  (${selectedIndex + 1}/${items.length})`), width));
    }
    return lines;
  }

  private renderModelItem(item: ModelItem, isSelected: boolean, width: number): string {
    const currentMark = modelsAreEqual(item.model, this.options.currentModel) ? this.theme.fg('success', ' ✓') : '';
    const providerBadge = this.theme.fg('muted', `[${item.model.provider}]`);
    const prefix = isSelected ? this.theme.fg('accent', '→ ') : '  ';
    const modelText = isSelected ? this.theme.fg('accent', item.model.id) : item.model.id;
    return this.line(`${prefix}${modelText} ${providerBadge}${currentMark}`, width);
  }

  private renderHelp(): string {
    const tabHint = this.tabs.length > 1 ? 'tab/shift+tab switch sections • ' : '';
    return this.theme.fg('dim', `${tabHint}↑↓ navigate • enter select • esc cancel`);
  }

  private line(text: string, width: number): string {
    return truncateToWidth(text.replace(/[\r\n]+/g, ' '), Math.max(1, width), '');
  }
}
