import { describe, expect, test } from 'bun:test';
import type { KeybindingsManager, Theme } from '@earendil-works/pi-coding-agent';
import { buildSnapshot, type ContextUsageSnapshot } from '../../src/extensions/context-view/model';
import { ContextViewDialog } from '../../src/extensions/context-view/ui/context-view-dialog';

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

function createDialog(rows = 24): ContextViewDialog {
  const tui = { terminal: { rows }, requestRender: () => undefined };
  return new ContextViewDialog(
    tui as never,
    theme,
    { matches: () => false } as unknown as KeybindingsManager,
    { usage, initial: buildSnapshot([], 'real-turn', new Date()) },
    () => undefined,
  );
}

describe('ContextViewDialog', () => {
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
