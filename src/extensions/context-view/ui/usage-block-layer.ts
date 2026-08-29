/** Selectable chronological Usage preview layer with height-bounded entry excerpts. */
import type { Theme } from '@earendil-works/pi-coding-agent';

import { BODY_INDENT, calculateViewport, fitLine, type Hint, type ModalLayer, type NavigationAction, spreadLine } from '../../../libs/modal';
import type { UsagePreviewEntry } from '../model';
import { BlockNavigator, layoutPreviewBlocks, type PreviewLayout } from './usage-preview';

const MAX_EXCERPT_LINES = 20;
const MIN_EXCERPT_LINES = 2;

export interface UsageBlockLayerOptions {
  readonly title: string | (() => string);
  readonly meta?: string | (() => string);
  readonly entries: readonly UsagePreviewEntry[];
  readonly entryHeader: (entry: UsagePreviewEntry) => string;
  readonly entryBody: (entry: UsagePreviewEntry, width: number) => string[];
  readonly description?: (width: number) => string[];
  readonly openFullContent: (entry: UsagePreviewEntry) => void;
}

interface RenderedBlock {
  readonly lines: readonly string[];
  readonly truncated: boolean;
}

export class UsageBlockLayer implements ModalLayer {
  private readonly navigator = new BlockNavigator();
  private blocks: readonly RenderedBlock[] = [];
  private layout: PreviewLayout = layoutPreviewBlocks([]);
  private cacheKey: string | undefined;

  public constructor(
    private readonly theme: Theme,
    private readonly options: UsageBlockLayerOptions,
  ) {}

  public hints(): Hint[] {
    const selected = this.blocks[this.navigator.selected];
    return selected?.truncated === true ? [['Enter', 'View Content']] : [];
  }

  public handleInput(_data: string): void {
    // Navigation is supplied as semantic actions by the modal shell.
  }

  public handleNavigation(action: NavigationAction): void {
    switch (action) {
      case 'step-back':
        this.navigator.stepBack();
        break;
      case 'step-forward':
        this.navigator.stepForward();
        break;
      case 'page-back':
        this.navigator.page(-1);
        break;
      case 'page-forward':
        this.navigator.page(1);
        break;
      case 'first':
        this.navigator.moveToFirst();
        break;
      case 'last':
        this.navigator.moveToLast();
        break;
      case 'confirm': {
        if (this.blocks[this.navigator.selected]?.truncated !== true) return;
        const entry = this.options.entries[this.navigator.selected];
        if (entry !== undefined) this.options.openFullContent(entry);
        break;
      }
    }
  }

  public render(width: number, height: number | undefined): string[] {
    const description = this.options.description?.(width) ?? [];
    // Reserve one row for the overflow counter whenever the stream needs it;
    // an unused row is preferable to clipping a pinned description.
    const fixedLineCount = 3 + (description.length > 0 ? description.length + 1 : 0);
    const available = Math.max(1, (height ?? 20) - fixedLineCount);
    const excerptCap = Math.max(MIN_EXCERPT_LINES, Math.min(MAX_EXCERPT_LINES, Math.floor((available - 3) / 2)));
    this.buildBlocks(width, excerptCap);

    const viewport = calculateViewport(this.layout.lines.length, height ?? this.layout.lines.length + fixedLineCount, fixedLineCount);
    this.navigator.setExtent(this.layout, viewport.visibleCount);
    const title = typeof this.options.title === 'function' ? this.options.title() : this.options.title;
    const metaOption = this.options.meta;
    const meta = typeof metaOption === 'function' ? metaOption() : (metaOption ?? '');
    const lines = [spreadLine(title, meta, width), ''];

    if (this.blocks.length === 0) {
      lines.push(fitLine(this.theme.fg('muted', `${BODY_INDENT}No content captured for this category.`), width));
    } else {
      for (let index = this.navigator.offset; index < this.navigator.offset + viewport.visibleCount; index++) {
        const ref = this.layout.lines[index];
        if (ref === undefined) {
          lines.push('');
          continue;
        }
        const block = this.blocks[ref.blockIndex];
        const line = block?.lines[ref.lineIndex] ?? '';
        const cursor = ref.lineIndex === 0 && ref.blockIndex === this.navigator.selected ? this.theme.fg('accent', '→ ') : '  ';
        lines.push(fitLine(`${cursor}${line}`, width));
      }
    }
    if (viewport.showScroll) {
      lines.push(
        fitLine(
          this.theme.fg(
            'dim',
            `${BODY_INDENT}(${Math.min(this.layout.lines.length, this.navigator.offset + viewport.visibleCount)}/${this.layout.lines.length})`,
          ),
          width,
        ),
      );
    }
    if (description.length > 0) lines.push('', ...description);
    return lines;
  }

  public invalidate(): void {
    this.cacheKey = undefined;
  }

  private buildBlocks(width: number, excerptCap: number): void {
    const bodyWidth = Math.max(10, width - 2);
    const key = `${bodyWidth}:${excerptCap}`;
    if (this.cacheKey === key) return;
    this.blocks = this.options.entries.map(entry => {
      const body = this.options.entryBody(entry, bodyWidth);
      const truncated = body.length > excerptCap;
      const visible = truncated ? body.slice(0, excerptCap) : body;
      const marker = truncated ? [`${BODY_INDENT}${this.theme.fg('dim', `… +${body.length - visible.length} lines`)}`] : [];
      return { lines: [this.options.entryHeader(entry), ...visible, ...marker], truncated };
    });
    this.layout = layoutPreviewBlocks(this.blocks.map(block => block.lines.length));
    this.cacheKey = key;
  }
}
