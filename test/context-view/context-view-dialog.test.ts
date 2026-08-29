import { describe, expect, test } from 'bun:test';
import type { KeybindingsManager, Theme } from '@earendil-works/pi-coding-agent';
import { buildSnapshot, type ContextUsageSnapshot } from '../../src/extensions/context-view/model';
import { ContextViewDialog } from '../../src/extensions/context-view/ui/context-view-dialog';
import type { ModalFrame } from '../../src/libs/modal';

const theme = {
  fg: (_color: string, text: string) => text,
  bold: (text: string) => text,
} as Theme;

const usage: ContextUsageSnapshot = {
  computedAt: new Date(),
  reported: { contextWindow: 100_000, tokens: 20, percent: 1 },
  categories: [
    { id: 'one', label: 'One', tokens: 10, entries: [{ breadcrumb: ['one'], tokens: 10, text: 'first' }] },
    { id: 'two', label: 'Two', tokens: 10, entries: [{ breadcrumb: ['two'], tokens: 10, text: 'second' }] },
  ],
  estimatedTokens: 20,
};

function createDialog(rows = 24, frame: ModalFrame = 'inline', usageInput: ContextUsageSnapshot = usage): ContextViewDialog {
  const tui = { terminal: { rows }, requestRender: () => undefined };
  return new ContextViewDialog(
    tui as never,
    theme,
    { matches: () => false } as unknown as KeybindingsManager,
    { usage: usageInput, initial: buildSnapshot([], 'real-turn', new Date()) },
    () => undefined,
    frame,
  );
}

describe('ContextViewDialog', () => {
  test('renders an overlay frame without changing the half-height bound', () => {
    const dialog = createDialog(24, 'bordered');
    const rendered = dialog.render(80);
    expect(rendered[0]).toMatch(/^╭─+╮$/);
    expect(rendered.at(-1)).toMatch(/^╰─+╯$/);
    expect(rendered.length).toBeLessThanOrEqual(12);
  });

  test('opens on Usage, renders tabs, wraps both directions, and fits half the terminal', () => {
    const dialog = createDialog();
    expect(dialog.activeTab).toBe('usage');
    expect(dialog.render(80)[1]).toContain('[Usage]  [Injections]');
    expect(dialog.render(80).length).toBeLessThanOrEqual(12);

    dialog.handleInput('\t');
    expect(dialog.activeTab).toBe('injections');
    dialog.handleInput('\t');
    expect(dialog.activeTab).toBe('usage');
    dialog.handleInput('\u001b[Z');
    expect(dialog.activeTab).toBe('injections');
  });

  test('shows map block size only when the proportional map is available', () => {
    const dialog = createDialog(40);
    expect(dialog.render(100).join('\n')).toContain('Block Size:');
    expect(dialog.render(100).join('\n')).toContain('/cell');
    expect(dialog.render(40).join('\n')).not.toContain('/cell');
  });

  test('opens truncated Usage blocks as nested full-content previews and restores block state', () => {
    const longUsage: ContextUsageSnapshot = {
      ...usage,
      categories: [{
        id: 'long',
        label: 'Long',
        tokens: 30,
        entries: [
          { breadcrumb: ['first'], tokens: 20, text: Array.from({ length: 30 }, (_, index) => `long line ${index + 1}`).join('\n') },
          { breadcrumb: ['second'], tokens: 10, text: 'complete second block' },
        ],
      }],
      estimatedTokens: 30,
    };
    const dialog = createDialog(40, 'inline', longUsage);
    dialog.handleInput('\r');
    expect(dialog.render(100).join('\n')).toContain('… +');
    dialog.handleInput('\r');
    dialog.render(100);
    dialog.handleInput('G');
    const full = dialog.render(100).join('\n');
    expect(full).toContain('long line 30');
    dialog.handleInput('\u001b');
    expect(dialog.render(100).join('\n')).toContain('→ [first]');
    dialog.handleInput('\t');
    expect(dialog.activeTab).toBe('injections');
    dialog.handleInput('\t');
    expect(dialog.render(100).join('\n')).toContain('→ [first]');
  });

  test('retains child state and permits tab switching from a preview', () => {
    const dialog = createDialog(40);
    dialog.handleInput('j');
    expect(dialog.render(100).join('\n')).toContain('→ ■ Two');
    dialog.handleInput('\r');
    dialog.handleInput('\t');
    expect(dialog.activeTab).toBe('injections');
    dialog.handleInput('\t');
    expect(dialog.render(100).join('\n')).toContain('Two');
  });
});
