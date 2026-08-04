import { describe, expect, test } from 'bun:test';
import type { KeybindingsManager, Theme } from '@earendil-works/pi-coding-agent';
import {
  ListTab,
  type ListTabOptions,
  ModalDialog,
  type ModalDialogOptions,
  type ModalTab,
  type ModalTabContext,
  PreviewLayer,
  VimNavigationScheme,
} from '../../src/libs/modal';

const theme = {
  fg: (_color: string, text: string) => text,
  bold: (text: string) => text,
} as Theme;

const keybindings = {
  matches: (data: string, action: string) =>
    ({
      tab: 'tui.input.tab',
      up: 'tui.select.up',
      down: 'tui.select.down',
      enter: 'tui.select.confirm',
      esc: 'tui.select.cancel',
    })[data] === action,
} as unknown as KeybindingsManager;

function listTab<T>(items: T[], overrides: Partial<ListTabOptions<T>> = {}): ListTab<T> {
  return new ListTab<T>(theme, {
    label: counts => `[Items ${counts.filtered}]`,
    items,
    renderRow: (item, selected) => `${selected ? '→ ' : '  '}${String(item)}`,
    onConfirm: () => undefined,
    ...overrides,
  });
}

function createDialog<TResult>(
  tabs: ModalTab[],
  options: Partial<ModalDialogOptions<TResult>> & { onComplete: (result: TResult) => void },
): ModalDialog<TResult> {
  const tui = { terminal: { rows: 24 }, requestRender: () => undefined };
  return new ModalDialog<TResult>(tui as never, theme, keybindings, { cancelValue: null as TResult, ...options, tabs });
}

describe('ModalDialog', () => {
  test('cycles tabs with wrapping in both directions and retains per-tab selection', () => {
    const first = listTab(['a', 'b']);
    const second = listTab(['c', 'd']);
    const dialog = createDialog([first, second], { onComplete: () => undefined });

    dialog.handleInput('down');
    dialog.handleInput('tab');
    dialog.handleInput('tab');
    expect(dialog.activeIndex).toBe(0);
    dialog.handleInput('\x1b[Z');
    expect(dialog.activeIndex).toBe(1);

    // First tab kept its selection on b while we were away.
    expect(first.render(40, undefined).join('\n')).toContain('→ b');
  });

  test('confirm resolves the selected value and cancel resolves the cancel value', () => {
    const results: Array<string | null> = [];
    const tab = listTab(['a', 'b'], { onConfirm: item => results.push(item) });
    const dialog = createDialog<string | null>([tab], { onComplete: result => results.push(result) });

    dialog.handleInput('down');
    dialog.handleInput('enter');
    dialog.handleInput('esc');
    expect(results).toEqual(['b', null]);
  });

  test('clamps at list bounds by default and wraps when enabled', () => {
    const clamped = listTab(['a', 'b']);
    const clampedDialog = createDialog([clamped], { onComplete: () => undefined });
    clampedDialog.handleInput('up');
    expect(clamped.render(40, undefined)[0]).toContain('→ a');

    const wrapped = listTab(['a', 'b'], { wrap: true });
    const wrappedDialog = createDialog([wrapped], { onComplete: () => undefined });
    wrappedDialog.handleInput('up');
    expect(wrapped.render(40, undefined).join('\n')).toContain('→ b');
  });

  test('dismissal pops a preview layer before closing the dialog', () => {
    const completed: Array<string | null> = [];
    const tab: ModalTab = listTab(['a']);
    let context: ModalTabContext | undefined;
    tab.attach = ctx => {
      context = ctx;
    };
    const dialog = createDialog<string | null>([tab], {
      navigation: new VimNavigationScheme(),
      onComplete: result => completed.push(result),
    });

    context?.pushLayer(new PreviewLayer(theme, { title: 'Preview', body: () => ['line one', 'line two'] }));
    expect(dialog.render(60).join('\n')).toContain('Preview');

    dialog.handleInput('q'); // closes the layer
    expect(dialog.render(60).join('\n')).not.toContain('Preview');
    expect(completed).toEqual([]);

    dialog.handleInput('q'); // closes the dialog
    expect(completed).toEqual([null]);
  });

  test('shared filter query re-filters every tab and persists across switches', () => {
    const first = listTab(['alpha', 'zeta'], { filterText: item => item });
    const second = listTab(['alpha', 'beta'], { filterText: item => item });
    const dialog = createDialog([first, second], { filter: {}, onComplete: () => undefined });

    dialog.handleInput('z');
    expect(first.render(40, undefined).join('\n')).toContain('zeta');
    expect(first.render(40, undefined).join('\n')).not.toContain('alpha');

    dialog.handleInput('tab');
    expect(second.render(40, undefined).join('\n')).not.toContain('alpha');
    expect(second.label).toBe('[Items 0]');

    dialog.handleInput('tab');
    expect(first.label).toBe('[Items 1]');
  });

  test('renders title, notices, and the help footer', () => {
    const tab = listTab(['a']);
    const dialog = createDialog([tab], {
      title: 'Pick one',
      notices: ['first warning', 'second warning'],
      maxNoticeLines: 1,
      onComplete: () => undefined,
    });

    const rendered = dialog.render(60).join('\n');
    expect(rendered).toContain('Pick one');
    expect(rendered).toContain('⚠ first warning');
    expect(rendered).toContain('1 more warning(s)');
    expect(rendered).toContain('Esc Close');
  });

  test('bounds total height to half the terminal', () => {
    const tab = listTab(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']);
    const dialog = createDialog([tab], { height: 'half', onComplete: () => undefined });
    expect(dialog.render(80).length).toBeLessThanOrEqual(12);
  });

  test('bordered frame wraps content in a rounded border', () => {
    const dialog = createDialog([listTab(['a'])], { frame: 'bordered', onComplete: () => undefined });
    const rendered = dialog.render(40);
    expect(rendered[0]).toMatch(/^╭─+╮$/);
    expect(rendered[rendered.length - 1]).toMatch(/^╰─+╯$/);
    expect(rendered[1]).toMatch(/^│.*│$/);
  });

  test('tab strip keeps the active label visible with omission markers at narrow widths', () => {
    const tabs = ['one', 'two', 'three', 'four', 'five'].map(name => listTab([name], { label: `[${name} 1]` }));
    const dialog = createDialog(tabs, { initialTabIndex: 4, onComplete: () => undefined });
    const strip = dialog.render(22)[1] ?? '';
    expect(strip).toContain('five');
    expect(strip).toContain('…');
  });
});
