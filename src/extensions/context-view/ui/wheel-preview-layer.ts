/**
 * Context View preview layer with mouse-wheel support.
 *
 * The shared modal `PreviewLayer` is scroll-only through semantic navigation
 * actions; the Context View adds opt-in wheel scrolling on top, since pi
 * forwards wheel reports only to a focused overlay and never consumes them
 * itself. This layer mirrors the shared preview frame while stepping its own
 * `PreviewScroller` on a wheel notch.
 */
import type { Theme } from '@earendil-works/pi-coding-agent';

import {
  BODY_INDENT,
  calculateViewport,
  fitLine,
  type Hint,
  type ModalLayer,
  type NavigationAction,
  PreviewScroller,
  spreadLine,
} from '../../../libs/modal';
import { DEFAULT_WHEEL_SCROLL_LINES, parseWheelDirection } from './wheel';

export interface WheelPreviewLayerOptions {
  /** Styled title rendered on the left of the header line. */
  title: string | (() => string);
  /** Muted metadata rendered right-aligned beside the title. */
  meta?: string | (() => string);
  /** Body lines for the given width; wrapping is the caller's concern. */
  body: (width: number) => string[];
  /** Optional fixed description lines pinned below the body, given the layer's width and height. */
  description?: (width: number, height: number | undefined) => string[];
  /** Layer-specific hints appended after the navigation scheme's hints. */
  hints?: () => Hint[];
  /** Lines one wheel notch scrolls; defaults to the project fallback. */
  wheelScrollLines?: number;
}

export class WheelPreviewLayer implements ModalLayer {
  private readonly scroller = new PreviewScroller();

  public constructor(
    private readonly theme: Theme,
    private readonly options: WheelPreviewLayerOptions,
  ) {}

  public hints(): Hint[] {
    return this.options.hints?.() ?? [];
  }

  /** Scroll one wheel notch; every other raw key is ignored by the preview. */
  public handleInput(data: string): void {
    const wheel = parseWheelDirection(data);
    if (wheel === undefined) return;
    this.scroller.scrollBy(wheel * (this.options.wheelScrollLines ?? DEFAULT_WHEEL_SCROLL_LINES));
  }

  public handleNavigation(action: NavigationAction): void {
    switch (action) {
      case 'step-back':
        this.scroller.scrollBy(-1);
        break;
      case 'step-forward':
        this.scroller.scrollBy(1);
        break;
      case 'page-back':
        this.scroller.page(-1);
        break;
      case 'page-forward':
        this.scroller.page(1);
        break;
      case 'first':
        this.scroller.scrollTo(0);
        break;
      case 'last':
        this.scroller.scrollTo(this.scroller.maxOffset);
        break;
    }
  }

  public render(width: number, height: number | undefined): string[] {
    const body = this.options.body(width);
    const description = this.options.description?.(width, height) ?? [];
    // title + blank, plus blank + description when present
    const fixedLineCount = 2 + (description.length > 0 ? description.length + 1 : 0);
    const viewport = calculateViewport(body.length, height ?? body.length + fixedLineCount, fixedLineCount);
    this.scroller.setExtent(body.length, viewport.visibleCount);

    const title = typeof this.options.title === 'function' ? this.options.title() : this.options.title;
    const metaOption = this.options.meta;
    const meta = typeof metaOption === 'function' ? metaOption() : (metaOption ?? '');

    const lines: string[] = [spreadLine(title, meta, width), ''];
    const start = this.scroller.offset;
    for (let index = start; index < start + viewport.visibleCount; index++) {
      lines.push(body[index] ?? '');
    }
    if (viewport.showScroll) {
      lines.push(fitLine(this.theme.fg('dim', `${BODY_INDENT}(${this.scroller.visibleEnd}/${body.length})`), width));
    }
    if (description.length > 0) lines.push('', ...description);
    return lines;
  }
}
