import { modelsAreEqual } from '@earendil-works/pi-ai';
import type { KeybindingsManager, Theme } from '@earendil-works/pi-coding-agent';
import type { Component, Focusable, TUI } from '@earendil-works/pi-tui';
import { ListTab, ModalDialog, type ModalTab } from '../../libs/modal';
import { MAX_CONFIG_WARNING_LINES, MAX_VISIBLE_MODELS } from './constants';
import { ModelFormatter } from './model-formatter';
import type { DialogOptions, DialogResult, ModelItem, TabIdentity } from './types';

/**
 * Model picker dialog: a `ModalDialog` configured with one `ListTab` per
 * section (permanent Favourites, configured groups, Search), a shared filter
 * input, and wrap-around picker navigation driven by the host keybindings.
 */
export class ModelSelectDialog implements Component, Focusable {
  private readonly dialog: ModalDialog<DialogResult>;

  constructor(
    tui: TUI,
    private readonly theme: Theme,
    keybindings: KeybindingsManager,
    private readonly options: DialogOptions,
  ) {
    const definitions: Array<{ identity: TabIdentity; label: string; items: ModelItem[] }> = [
      { identity: { kind: 'favourites' }, label: options.favouriteLabel, items: options.favouriteItems },
    ];
    if (!options.hideGroupTabs) {
      definitions.push(
        ...options.groupLists.map(group => ({ identity: { kind: 'group', name: group.name } as const, label: group.name, items: group.items })),
      );
    }
    if (!options.hideSearchTab) {
      definitions.push({ identity: { kind: 'search' }, label: 'Search', items: options.searchItems });
    }

    const tabs = definitions.map(definition => this.createTab(definition));
    const searchTabIndex = definitions.findIndex(definition => definition.identity.kind === 'search');

    this.dialog = new ModalDialog<DialogResult>(tui, theme, keybindings, {
      tabs,
      initialTabIndex: options.initialSearch !== '' && searchTabIndex >= 0 ? searchTabIndex : 0,
      title: this.renderTitle(),
      notices: options.configWarnings,
      maxNoticeLines: MAX_CONFIG_WARNING_LINES,
      filter: { initialQuery: options.initialSearch },
      frame: options.frame,
      cancelValue: null,
      onComplete: result => options.onDone(result),
    });
  }

  get focused(): boolean {
    return this.dialog.focused;
  }

  set focused(value: boolean) {
    this.dialog.focused = value;
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

  private createTab(definition: { identity: TabIdentity; label: string; items: ModelItem[] }): ModalTab {
    const currentIndex = this.options.currentModel ? definition.items.findIndex(item => modelsAreEqual(item.model, this.options.currentModel)) : -1;

    return new ListTab<ModelItem>(this.theme, {
      label: counts => `[${definition.label} ${counts.filtered}]`,
      items: definition.items,
      initialIndex: currentIndex >= 0 ? currentIndex : 0,
      wrap: true,
      visibleCount: MAX_VISIBLE_MODELS,
      filterText: item => item.searchText,
      filterCaption: () => this.filterCaption(definition.identity),
      emptyMessage: () => this.emptyMessage(definition),
      noMatchMessage: `No matching ${definition.identity.kind === 'search' ? 'models' : 'favourites'}`,
      renderRow: (item, selected) => this.renderModelItem(item, selected),
      footer: state => this.renderFooter(definition.identity, state.selected),
      onConfirm: item => this.dialog.complete(item.model),
    });
  }

  private filterCaption(identity: TabIdentity): string[] {
    if (identity.kind !== 'search') return [this.theme.fg('muted', 'Filter:')];
    const providerText =
      this.options.providerFilter.length === 0 ? 'all authorized providers' : `providers: ${this.options.providerFilter.join(', ')}`;
    return [this.theme.fg('muted', `Provider filter: ${providerText}`), this.theme.fg('muted', 'Search query:')];
  }

  private emptyMessage(definition: { identity: TabIdentity; label: string }): string {
    if (definition.identity.kind === 'favourites') return 'No configured favourites are available.';
    if (definition.identity.kind === 'group') return `No available favourites in ${definition.label}.`;
    return 'No matching models';
  }

  private renderFooter(identity: TabIdentity, selected: ModelItem | undefined): string[] {
    const lines: string[] = [];
    if (selected !== undefined) {
      lines.push('', this.theme.fg('muted', `  ${selected.description}`));
    }
    if (identity.kind === 'favourites') {
      const warnings = this.options.favouriteWarnings;
      const shown = warnings.slice(0, MAX_CONFIG_WARNING_LINES);
      for (const warning of shown) {
        lines.push(this.theme.fg('warning', `  ⚠ ${warning}`));
      }
      if (warnings.length > shown.length) {
        lines.push(this.theme.fg('warning', `  ⚠ ${warnings.length - shown.length} more favourite warning(s)`));
      }
    }
    return lines;
  }

  private renderModelItem(item: ModelItem, isSelected: boolean): string {
    const currentMark = modelsAreEqual(item.model, this.options.currentModel) ? this.theme.fg('success', ' ✓') : '';
    const providerBadge = this.theme.fg('muted', `[${item.model.provider}]`);
    const prefix = isSelected ? this.theme.fg('accent', '→ ') : '  ';
    const modelText = isSelected ? this.theme.fg('accent', item.model.id) : item.model.id;
    return `${prefix}${modelText} ${providerBadge}${currentMark}`;
  }

  private renderTitle(): string {
    const current = this.options.currentModel ? ModelFormatter.modelLabel(this.options.currentModel) : 'none';
    const reasoning = this.options.defaultReasoning ? ` • reasoning: ${this.options.defaultReasoning}` : '';
    return `${this.theme.fg('customMessageLabel', this.theme.bold('Select Model'))} ${this.theme.fg('muted', `current: ${current}${reasoning}`)}`;
  }
}
