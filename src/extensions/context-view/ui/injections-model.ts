/** Forked from dimk90/pi-context-view at f6f007b867212bcf81a61519c8e40ce209cdd608 (MIT). */
/**
 * Pure presentation model for the Injections view: flattened rows. No pi or
 * TUI access — unit-testable. List navigation and preview scrolling live in
 * the shared modal library; terminal sanitizers live in `../text` and are
 * re-exported here for callers that reached them through this module.
 */
import type { Theme } from '@earendil-works/pi-coding-agent';
import type { InitialSnapshot, InjectionItem } from '../model';
import { normalizePreviewText } from '../text';
import { expandJsonSpan } from './json-preview';
import { findMatches, normalizeSearchText } from './search';
import { previewBodyLines } from './section-preview';

export { normalizeInlineText, normalizePreviewText } from '../text';

export type InjectionFilterMode = 'name' | 'content';

export interface InjectionFilterResult {
  readonly snapshot: InitialSnapshot;
  readonly empty: boolean;
}

// The section renderer only uses these two theme operations. Keeping them
// transparent reuses its exact heading/reference/JSON derivation without ANSI.
const plainTheme = { fg: (_color: string, text: string) => text, bold: (text: string) => text } as Theme;

/** Unwrapped text shown by the Injections preview (including expanded JSON). */
export function injectionPreviewText(item: InjectionItem): string {
  return previewBodyLines(
    plainTheme,
    item,
    Number.MAX_SAFE_INTEGER,
    (text, span) => normalizePreviewText(expandJsonSpan(text, span)).split('\n'),
    item.label,
  ).join('\n');
}

/** Preserve original estimates; prune only visibility, never mutate the capture. */
export function filterInjections(snapshot: InitialSnapshot, query: string, mode: InjectionFilterMode): InjectionFilterResult {
  if (normalizeSearchText(query) === '') return { snapshot, empty: snapshot.groups.every(group => group.items.length === 0) };
  const matches = (text: string) => findMatches(text, query, mode === 'content').length > 0;
  const filterItem = (item: InjectionItem): InjectionItem | undefined => {
    const matched = matches(mode === 'name' ? item.label : injectionPreviewText(item));
    if (mode === 'name' && matched) return item;
    const children = (item.children ?? []).flatMap(child => {
      const kept = filterItem(child);
      return kept === undefined ? [] : [kept];
    });
    if (!matched && children.length === 0) return undefined;
    return { ...item, ...(item.children === undefined ? {} : { children }) };
  };
  const groups = snapshot.groups.flatMap(group => {
    if (mode === 'name' && matches(group.source.label)) return [group];
    const items = group.items.flatMap(item => {
      const kept = filterItem(item);
      return kept === undefined ? [] : [kept];
    });
    return items.length === 0 ? [] : [{ ...group, items }];
  });
  return { snapshot: { ...snapshot, groups }, empty: groups.length === 0 };
}

/** One flattened list row derived from the snapshot hierarchy. */
export type InjectionRow =
  | {
      readonly kind: 'group';
      readonly label: string;
      readonly tokens: number;
      readonly depth: 0;
    }
  | {
      readonly kind: 'item';
      readonly label: string;
      readonly tokens: number;
      /** One for items and two for constituent sub-items. */
      readonly depth: 1 | 2;
      /** Whether this row is the final sibling at its depth. */
      readonly isLast: boolean;
      /** Whether a depth-two row's parent has a following sibling. */
      readonly parentContinues?: boolean;
      /** Whether a `--system-prompt` replacement dropped this contribution. */
      readonly dropped?: boolean;
      /** Whether an extension moved this part out of the region pi renders it into. */
      readonly moved?: boolean;
      /** Stable preview target id from the snapshot. */
      readonly itemId: string;
    }
  | {
      readonly kind: 'separator';
      readonly label: '';
      readonly tokens: 0;
      readonly depth: 0;
    }
  | {
      readonly kind: 'total';
      readonly label: 'TOTAL';
      readonly tokens: number;
      readonly depth: 0;
    };

/** Index snapshot items (including sub-items) by id for preview lookup. */
export function collectItemsById(snapshot: InitialSnapshot): Map<string, InjectionItem> {
  const items = new Map<string, InjectionItem>();
  for (const group of snapshot.groups) {
    for (const item of group.items) {
      items.set(item.id, item);
      for (const child of item.children ?? []) items.set(child.id, child);
    }
  }
  return items;
}

/** Flatten snapshot groups into rows separated from the non-selectable Initial total. */
export function buildInjectionRows(snapshot: InitialSnapshot): InjectionRow[] {
  const rows: InjectionRow[] = [];
  for (const group of snapshot.groups) {
    rows.push({
      kind: 'group',
      label: group.source.label,
      tokens: group.totalTokens,
      depth: 0,
    });
    group.items.forEach((item, itemIndex) => {
      const isLastItem = itemIndex === group.items.length - 1;
      rows.push({
        kind: 'item',
        label: item.label,
        tokens: item.tokens,
        depth: 1,
        isLast: isLastItem,
        dropped: item.dropped,
        moved: item.moved,
        itemId: item.id,
      });
      const children = item.children ?? [];
      children.forEach((child, childIndex) => {
        rows.push({
          kind: 'item',
          label: child.label,
          tokens: child.tokens,
          depth: 2,
          isLast: childIndex === children.length - 1,
          parentContinues: !isLastItem,
          dropped: child.dropped,
          moved: child.moved,
          itemId: child.id,
        });
      });
    });
  }
  rows.push({ kind: 'separator', label: '', tokens: 0, depth: 0 });
  rows.push({ kind: 'total', label: 'TOTAL', tokens: snapshot.totalTokens, depth: 0 });
  return rows;
}
