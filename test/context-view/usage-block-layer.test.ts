import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Theme } from '@earendil-works/pi-coding-agent';
import type { UsagePreviewEntry } from '../../src/extensions/context-view/model.ts';
import { UsageBlockLayer } from '../../src/extensions/context-view/ui/usage-block-layer.ts';

const theme = { fg: (_color: string, text: string) => text, bold: (text: string) => text } as Theme;
const entries: UsagePreviewEntry[] = [
  { breadcrumb: ['first'], tokens: 10, text: Array.from({ length: 10 }, (_, i) => `line ${i + 1}`).join('\n') },
  { breadcrumb: ['second'], tokens: 1, text: 'complete' },
];

function layer(opened: UsagePreviewEntry[], widthSensitive = false, description = false): UsageBlockLayer {
  return new UsageBlockLayer(theme, {
    title: 'Entries',
    entries,
    entryHeader: entry => `[${entry.breadcrumb[0]}]`,
    entryBody: (entry, width) => {
      const lines = entry.text.split('\n');
      return widthSensitive && width < 30 ? lines.flatMap(line => [line, `${line} wrapped`]) : lines;
    },
    description: description ? () => ['pinned description'] : undefined,
    openFullContent: entry => opened.push(entry),
  });
}

test('UsageBlockLayer renders selectable capped blocks and skips complete confirmations', () => {
  const opened: UsagePreviewEntry[] = [];
  const preview = layer(opened);
  const rendered = preview.render(60, 12).join('\n');
  assert.match(rendered, /→ \[first\]/);
  assert.match(rendered, /… \+7 lines/);

  preview.handleNavigation('confirm');
  assert.strictEqual(opened[0], entries[0]);
  preview.handleNavigation('step-forward');
  assert.match(preview.render(60, 12).join('\n'), /→ \[second\]/);
  preview.handleNavigation('confirm');
  assert.equal(opened.length, 1);
});

test('UsageBlockLayer budgets overflow counters without clipping pinned descriptions', () => {
  const rendered = layer([], false, true).render(60, 12);
  assert.ok(rendered.length <= 12);
  assert.equal(rendered.at(-1), 'pinned description');
});

test('UsageBlockLayer re-caps on height and width changes', () => {
  const opened: UsagePreviewEntry[] = [];
  const preview = layer(opened, true);
  assert.match(preview.render(20, 12).join('\n'), /… \+/);
  preview.render(60, 40);
  preview.handleNavigation('first');
  preview.handleNavigation('confirm');
  assert.equal(opened.length, 0, 'the complete resized block does not open a redundant preview');
});
