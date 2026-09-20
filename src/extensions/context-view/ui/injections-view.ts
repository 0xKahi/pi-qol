/** Forked from dimk90/pi-context-view at f6f007b867212bcf81a61519c8e40ce209cdd608 (MIT). */
/**
 * Focused `/context injections` tab: hierarchical Initial snapshot rows. The
 * Runtime label stays hidden until the runtime-inspection roadmap step.
 * Modal plumbing — frame, navigation dispatch, previews, dismissal — is owned
 * by the shared modal library; this tab owns only its content.
 */
import type { Theme } from '@earendil-works/pi-coding-agent';
import { visibleWidth, wrapTextWithAnsi } from '@earendil-works/pi-tui';

import {
  BODY_INDENT,
  calculateViewport,
  fitLine,
  type Hint,
  ListNavigator,
  type ModalTab,
  type ModalTabContext,
  type NavigationAction,
  RenderCache,
  wrapDescriptionLines,
} from '../../../libs/modal';
import type { InitialSnapshot, InjectionItem } from '../model';
import { buildInjectionRows, collectItemsById, type InjectionRow, normalizeInlineText, normalizePreviewText } from './injections-model';
import { expandJsonSpan } from './json-preview';
import { type ContextMarker, droppedMarker, markerLegendLines, movedMarker } from './markers';
import { previewBodyLines, previewLegendLines } from './section-preview';
import { DEFAULT_WHEEL_SCROLL_LINES, parseWheelDirection } from './wheel';
import { WheelPreviewLayer } from './wheel-preview-layer';

const LIST_DESCRIPTION = 'Injections into the model context for the first turn, with token estimates.';
const CURSOR_COLUMN_WIDTH = 2;
const MAX_TOKEN_VALUE_COLUMN = 54;
const TOKEN_LEADER_GAP = 4;
/** Title + blank rows the wheel preview spends outside its body and legend. */
const PREVIEW_FIXED_LINE_COUNT = 2;

/** Everything the Injections view renders. */
export interface InjectionsViewInput {
  readonly snapshot: InitialSnapshot;
}

/** Shared token-value column measured after the fixed cursor column. */
interface InjectionColumns {
  readonly value: number;
}

/** Stateful Injections tab retained by the Context View dialog. */
export class InjectionsView implements ModalTab {
  private readonly theme: Theme;
  private readonly rows: InjectionRow[];
  private readonly navigator: ListNavigator;
  private readonly itemsById: Map<string, InjectionItem>;
  private readonly cache = new RenderCache();
  private readonly wheelScrollLines: number;
  private context: ModalTabContext | undefined;
  private previewItem: InjectionItem | undefined;
  private previewLines: string[] | undefined;
  private previewWrapWidth: number | undefined;

  public constructor(theme: Theme, input: InjectionsViewInput, wheelScrollLines: number = DEFAULT_WHEEL_SCROLL_LINES) {
    this.theme = theme;
    this.rows = buildInjectionRows(input.snapshot);
    this.navigator = new ListNavigator(this.rows.length, 1, this.rows.length - 2);
    this.itemsById = collectItemsById(input.snapshot);
    this.wheelScrollLines = wheelScrollLines;
  }

  public get label(): string {
    return '[Injections]';
  }

  public attach(context: ModalTabContext): void {
    this.context = context;
  }

  public hints(): Hint[] {
    return [['Enter', 'Preview']];
  }

  /** One wheel notch steps the selection one row, like a single step key. */
  public handleInput(data: string): void {
    const wheel = parseWheelDirection(data);
    if (wheel !== undefined && this.navigator.moveBy(wheel)) this.cache.clear();
  }

  /** Apply semantic movement in the hierarchy, or open an item preview. */
  public handleNavigation(action: NavigationAction): void {
    const changed =
      action === 'step-back'
        ? this.navigator.moveBy(-1)
        : action === 'step-forward'
          ? this.navigator.moveBy(1)
          : action === 'page-back'
            ? this.navigator.page(-1)
            : action === 'page-forward'
              ? this.navigator.page(1)
              : action === 'first'
                ? this.navigator.moveTo(0)
                : action === 'last'
                  ? this.navigator.moveTo(this.rows.length - 1)
                  : false;
    if (changed) this.cache.clear();
    if (action === 'confirm') this.openPreview();
  }

  public render(width: number, height: number | undefined): string[] {
    const cached = this.cache.read(width, height);
    if (cached !== undefined) return cached;

    const terminalRows = height ?? this.rows.length + 10;
    const headerLines = this.headerLines(width);
    const descriptionLines = this.descriptionLines(width);
    const viewport = calculateViewport(this.rows.length, terminalRows, headerLines.length + descriptionLines.length + 2);
    this.navigator.setVisibleCount(viewport.visibleCount);

    const lines: string[] = [...headerLines, ''];
    const listLines = this.listLines(width);
    lines.push(...listLines);
    if (viewport.showScroll) lines.push(this.scrollLine(width));
    const paddingCount = viewport.visibleCount - listLines.length;
    for (let pad = 0; pad < paddingCount; pad++) lines.push('');
    lines.push('', ...descriptionLines);

    return this.cache.write(width, height, lines);
  }

  public invalidate(): void {
    this.cache.clear();
  }

  // === Preview ===

  /** Open the selected item's content preview as a shell-managed layer. */
  private openPreview(): void {
    const row = this.rows[this.navigator.selected];
    if (row?.kind !== 'item') return;
    const item = this.itemsById.get(row.itemId);
    if (item === undefined) return;
    this.previewItem = item;
    this.previewLines = undefined;
    this.previewWrapWidth = undefined;

    const source = normalizeInlineText(item.source.label);
    const marker = item.moved === true ? movedMarker(this.theme) : '';
    this.context?.pushLayer(
      new WheelPreviewLayer(this.theme, {
        title: () => this.theme.fg('accent', this.theme.bold(normalizeInlineText(item.label))),
        meta: () => this.theme.fg('muted', `${source} · ${item.tokens.toLocaleString('en-US')} tokens`) + marker,
        body: width => this.getPreviewLines(width, item),
        description: (width, layerHeight) => this.previewLegendLines(width, layerHeight, item),
        wheelScrollLines: this.wheelScrollLines,
      }),
    );
  }

  /** Fixed legend for the markers this item's preview renders, when content leaves room for it. */
  private previewLegendLines(width: number, layerHeight: number | undefined, item: InjectionItem): string[] {
    return previewLegendLines(this.theme, [item], {
      width,
      availableRows: Math.max(1, (layerHeight ?? 24) - PREVIEW_FIXED_LINE_COUNT),
      contentLineCount: this.getPreviewLines(width, item).length,
    });
  }

  private getPreviewLines(width: number, item: InjectionItem): string[] {
    const wrapWidth = Math.max(10, width - BODY_INDENT.length - 1);
    if (this.previewItem === item && this.previewLines !== undefined && this.previewWrapWidth === wrapWidth) {
      return this.previewLines;
    }
    // The item preview is the full-content level, so marked JSON expands here.
    const lines = previewBodyLines(
      this.theme,
      item,
      wrapWidth,
      (text, jsonSpan) => this.wrappedTextLines(expandJsonSpan(text, jsonSpan), wrapWidth),
      item.label,
    );
    this.previewLines = lines;
    this.previewWrapWidth = wrapWidth;
    return lines;
  }

  /** Wrap sanitized text into indented preview lines, keeping blank lines. */
  private wrappedTextLines(text: string, wrapWidth: number): string[] {
    const lines: string[] = [];
    for (const paragraph of normalizePreviewText(text).split('\n')) {
      const wrapped = wrapTextWithAnsi(paragraph, wrapWidth);
      if (wrapped.length === 0) {
        lines.push('');
        continue;
      }
      for (const line of wrapped) lines.push(`${BODY_INDENT}${line}`);
    }
    return lines;
  }

  // === List rendering ===

  /** Keep title/label together when possible; give the narrow label its own breathing room. */
  private headerLines(width: number): string[] {
    const theme = this.theme;
    const title = theme.fg('accent', theme.bold('Context Injections'));
    const separator = theme.fg('dim', ' · ');
    // Runtime remains unimplemented, so only the Initial label is shown.
    const tabs = theme.fg('mdHeading', theme.bold('[INITIAL]'));
    const combined = `${title}${separator}${tabs}`;
    if (visibleWidth(combined) <= width) return [this.fit(combined, width)];
    return [this.fit(title, width), '', this.fit(tabs, width)];
  }

  /** Render the current hierarchy viewport against one stable, nearby value column. */
  private listLines(width: number): string[] {
    const theme = this.theme;
    const lines: string[] = [];
    const contentWidth = Math.max(1, width - CURSOR_COLUMN_WIDTH);
    const columns = this.injectionColumns(contentWidth);
    const start = this.navigator.offset;
    const end = start + this.navigator.windowSize;
    for (let index = start; index < end; index++) {
      const row = this.rows[index];
      if (row === undefined) break;
      if (row.kind === 'separator') {
        lines.push('');
        continue;
      }
      const selected = row.kind !== 'total' && index === this.navigator.selected;
      const cursor = selected ? theme.fg('accent', '→ ') : BODY_INDENT;
      const content = this.injectionLine(row, columns, contentWidth, selected);
      lines.push(this.fit(`${cursor}${content}`, width));
    }
    return lines;
  }

  /** Choose the earliest useful shared value column, capped on wide terminals. */
  private injectionColumns(width: number): InjectionColumns {
    const contentRows = this.rows.filter(row => row.kind !== 'separator');
    const labelWidth = Math.max(1, ...contentRows.map(row => visibleWidth(this.plainRowLabel(row))));
    const tokenWidth = Math.max(1, ...contentRows.map(row => row.tokens.toLocaleString('en-US').length));
    const idealValue = Math.min(MAX_TOKEN_VALUE_COLUMN, labelWidth + TOKEN_LEADER_GAP);
    return { value: Math.max(1, Math.min(idealValue, width - tokenWidth)) };
  }

  /** One hierarchy row with dim leaders, a full token estimate, and any state marker. */
  private injectionLine(
    row: Exclude<InjectionRow, { readonly kind: 'separator' }>,
    columns: InjectionColumns,
    width: number,
    selected: boolean,
  ): string {
    const labelWidth = Math.max(1, columns.value - 1);
    const left = fitLine(this.styledRowLabel(row, selected), labelWidth);
    const leader = this.tokenLeader(columns.value - visibleWidth(left));
    const value = row.tokens.toLocaleString('en-US');
    const tokens = row.kind === 'total' ? this.theme.bold(this.theme.fg('text', value)) : this.theme.fg(selected ? 'accent' : 'muted', value);
    const line = `${left}${leader}${tokens}`;
    return fitLine(`${line}${this.rowMarker(row, columns.value + value.length, width)}`, width);
  }

  /** State marker after the estimate, dropped whole rather than truncated when it does not fit. */
  private rowMarker(row: Exclude<InjectionRow, { readonly kind: 'separator' }>, lineWidth: number, width: number): string {
    if (row.kind !== 'item') return '';
    const marker = row.dropped === true ? droppedMarker(this.theme) : row.moved === true ? movedMarker(this.theme) : '';
    return lineWidth + visibleWidth(marker) <= width ? marker : '';
  }

  /** Fill a label/value gap with dim dots, retaining spaces at both ends. */
  private tokenLeader(width: number): string {
    if (width < 3) return ' '.repeat(Math.max(0, width));
    return ` ${this.theme.fg('dim', '.'.repeat(width - 2))} `;
  }

  /** Unstyled hierarchy label used to keep the value column stable while scrolling. */
  private plainRowLabel(row: Exclude<InjectionRow, { readonly kind: 'separator' }>): string {
    const label = normalizeInlineText(row.label);
    return row.kind === 'item' ? `${this.treePrefix(row)}${label}` : label;
  }

  /** Themed hierarchy label with connectors intentionally dim even on selection. */
  private styledRowLabel(row: Exclude<InjectionRow, { readonly kind: 'separator' }>, selected: boolean): string {
    const theme = this.theme;
    const label = normalizeInlineText(row.label);
    if (row.kind === 'group' || row.kind === 'total') {
      return theme.bold(theme.fg(selected ? 'accent' : 'text', label));
    }
    const prefix = theme.fg('dim', this.treePrefix(row));
    const color = selected ? 'accent' : row.depth === 1 ? 'muted' : 'dim';
    return `${prefix}${theme.fg(color, label)}`;
  }

  /** Tree branch and ancestor continuation prefix for one item row. */
  private treePrefix(row: Extract<InjectionRow, { readonly kind: 'item' }>): string {
    const branch = row.isLast ? '└─ ' : '├─ ';
    if (row.depth === 1) return branch;
    return `${row.parentContinues === true ? '│  ' : '   '}${branch}`;
  }

  private scrollLine(width: number): string {
    if (!this.navigator.hasOverflow) return this.fit('', width);
    return this.fit(this.theme.fg('dim', `${BODY_INDENT}(${this.navigator.selectedOrdinal + 1}/${this.navigator.selectableCount})`), width);
  }

  /**
   * Wrapped dialog description: the list sentence and one legend bullet per
   * marker the hierarchy rows show.
   */
  private descriptionLines(width: number): string[] {
    const lines = wrapDescriptionLines(this.theme, LIST_DESCRIPTION, 'dim', width);
    lines.push(...markerLegendLines(this.theme, this.rowMarkers(), width));
    return lines;
  }

  /** Markers the hierarchy rows carry, whatever the current width leaves room to render. */
  private rowMarkers(): ContextMarker[] {
    const items = this.rows.filter(row => row.kind === 'item');
    const markers: ContextMarker[] = [];
    if (items.some(row => row.dropped === true)) markers.push('dropped');
    if (items.some(row => row.moved === true)) markers.push('moved');
    return markers;
  }

  private fit(line: string, width: number): string {
    return fitLine(line, width);
  }
}
