/** Forked from dimk90/pi-context-view at f6f007b867212bcf81a61519c8e40ce209cdd608 (MIT). */
/**
 * Pure presentation model for the Injections view: flattened rows and
 * text sanitizers. No pi or TUI access — unit-testable. List navigation
 * and preview scrolling live in the shared modal library.
 */
import type { InitialSnapshot, InjectionItem } from '../model';

// biome-ignore lint/suspicious/noControlCharactersInRegex: terminal sanitizer intentionally matches control bytes.
const TERMINAL_STRING_SEQUENCE = /(?:\u001B[\]PX^_]|[\u0090\u0098\u009D\u009E\u009F])[\s\S]*?(?:\u0007|\u001B\\|\u009C)/g;
// biome-ignore lint/suspicious/noControlCharactersInRegex: terminal sanitizer intentionally matches control bytes.
const TERMINAL_CSI_SEQUENCE = /(?:\u001B\[|\u009B)[\u0030-\u003F]*[\u0020-\u002F]*[\u0040-\u007E]/g;
// biome-ignore lint/suspicious/noControlCharactersInRegex: terminal sanitizer intentionally matches control bytes.
const TERMINAL_ESCAPE_SEQUENCE = /\u001B[\u0020-\u002F]*[\u0030-\u007E]/g;
// biome-ignore lint/suspicious/noControlCharactersInRegex: terminal sanitizer intentionally matches control bytes.
const TERMINAL_CONTROL_CHARACTER = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/g;

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

/** Normalize whitespace and remove terminal control sequences from raw preview text. */
export function normalizePreviewText(text: string): string {
  return text
    .replaceAll('\r\n', '\n')
    .replaceAll('\r', '\n')
    .replaceAll('\t', '    ')
    .replace(TERMINAL_STRING_SEQUENCE, '')
    .replace(TERMINAL_CSI_SEQUENCE, '')
    .replace(TERMINAL_ESCAPE_SEQUENCE, '')
    .replace(TERMINAL_CONTROL_CHARACTER, '');
}

/** Sanitize dynamic text for one terminal line and collapse embedded whitespace. */
export function normalizeInlineText(text: string): string {
  return normalizePreviewText(text).replace(/\s+/g, ' ').trim();
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
          itemId: child.id,
        });
      });
    });
  }
  rows.push({ kind: 'separator', label: '', tokens: 0, depth: 0 });
  rows.push({ kind: 'total', label: 'TOTAL', tokens: snapshot.totalTokens, depth: 0 });
  return rows;
}
