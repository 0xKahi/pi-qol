import assert from 'node:assert/strict';
import { test } from 'node:test';

import type { Theme } from '@earendil-works/pi-coding-agent';

import type { ContextUsageSnapshot, UsageCategory, UsagePreviewEntry } from '../../src/extensions/context-view/model.ts';
import { buildSnapshot } from '../../src/extensions/context-view/model.ts';
import { ContextViewDialog } from '../../src/extensions/context-view/ui/context-view-dialog.ts';
import { UsageView } from '../../src/extensions/context-view/ui/usage-view.ts';
import type { ModalLayer } from '../../src/libs/modal/index.ts';

const theme = {
  fg: (_color: string, text: string) => text,
  bold: (text: string) => text,
} as Theme;

const attributedEntry: UsagePreviewEntry = {
  breadcrumb: ['Preamble'],
  tokens: 40,
  text: 'Guidelines:',
  sections: [
    {
      label: 'Prompt Snippet',
      text: '\n- Use search',
      tokens: 5,
      injectedReferences: [
        {
          offset: 0,
          text: '\n- Use search',
          itemId: 'system-prompt',
          source: { id: 'web', label: 'npm:web', native: false },
          tool: 'search',
          attribution: 'guess',
        },
      ],
    },
    { label: 'Available Tools', text: 'search: Search', tokens: 5, moved: true },
    { label: 'Definition', text: 'read({"path":"x"})', tokens: 5, jsonSpan: { start: 5, end: 17 } },
    { label: 'Filler', text: Array.from({ length: 30 }, (_, index) => `filler line ${index}`).join('\n'), tokens: 5 },
  ],
};

const categories: UsageCategory[] = [
  {
    id: 'system-prompt',
    label: 'System Prompt',
    tokens: 41,
    entries: [attributedEntry, { breadcrumb: ['Other'], tokens: 1, text: 'More' }],
  },
  { id: 'user-messages', label: 'User Messages', tokens: 10, entries: [{ breadcrumb: ['user'], tokens: 10, text: 'hello' }] },
];

function usage(): ContextUsageSnapshot {
  return {
    computedAt: new Date('2026-07-10T12:00:00Z'),
    reported: { tokens: 40, contextWindow: 100_000, percent: 0.04 },
    categories,
    estimatedTokens: 51,
  };
}

/** Capture the layer an Enter press pushes above the tab. */
function captureLayer(view: UsageView): () => ModalLayer | undefined {
  let captured: ModalLayer | undefined;
  view.attach({ pushLayer: layer => (captured = layer) });
  return () => captured;
}

test('UsageView moves the legend selection one row per wheel notch', () => {
  const view = new UsageView(theme, { usage: usage() });
  view.render(120, 40);
  const before = view.render(120, 40).find(line => line.includes('→'));
  view.handleInput('\u001b[<65;1;1M');
  const after = view.render(120, 40).find(line => line.includes('→'));
  assert.notEqual(after, before);
});

test('UsageView preview renders sections, restored references, JSON, and the marker legend', () => {
  const view = new UsageView(theme, { usage: usage() });
  const layer = captureLayer(view);
  view.render(120, 40);
  view.handleNavigation('confirm');
  const preview = layer();
  assert.ok(preview !== undefined);

  const text = preview.render(120, 40).join('\n');
  assert.match(text, /Prompt Snippet · 5 tokens/);
  assert.ok(text.includes('- Use search\u00A0<-\u00A0npm:web:search (guess)'));
  assert.match(text, /Available Tools · 5 tokens · Moved/);
  assert.match(text, /"path": "x"/);
  // Both the restored reference and the moved block are explained below the content.
  assert.match(text, /- Highlighted parts are injected by extensions/);
  assert.match(text, /- Moved blocks appear in a different position/);
});

test('UsageBlockLayer scrolls one block per wheel notch through its layer handleInput', () => {
  const view = new UsageView(theme, { usage: usage() });
  const layer = captureLayer(view);
  view.render(120, 40);
  view.handleNavigation('confirm');
  const preview = layer();
  assert.ok(preview !== undefined);
  view.render(120, 40);
  // A fresh preview starts on the first block; a notch down scrolls its content.
  const first = preview.render(120, 40);
  preview.handleInput('\u001b[<65;1;1M');
  assert.notDeepEqual(preview.render(120, 40), first);
});

test('UsageView full content repeats the marker legend for its entry', () => {
  const view = new UsageView(theme, { usage: usage() });
  const layers: ModalLayer[] = [];
  view.attach({ pushLayer: layer => layers.push(layer) });
  view.render(120, 40);
  view.handleNavigation('confirm');
  const block = layers.at(-1);
  assert.ok(block !== undefined);
  block.render(120, 40); // establish the height-dependent block cap
  block.handleNavigation('confirm');
  const full = layers.at(-1);
  assert.ok(full !== undefined && full !== block);

  const text = full.render(120, 40).join('\n');
  assert.match(text, /- Highlighted parts are injected by extensions/);
  assert.match(text, /- \(guess\) sources are inferred/);
  assert.match(text, /- Moved blocks appear in a different position/);
});

test('ContextViewDialog threads the host wheel step into usage full-content previews', () => {
  const longUsage: ContextUsageSnapshot = {
    computedAt: new Date('2026-07-10T12:00:00Z'),
    reported: { tokens: 30, contextWindow: 100_000, percent: 0.03 },
    categories: [
      {
        id: 'long',
        label: 'Long',
        tokens: 30,
        entries: [{ breadcrumb: ['first'], tokens: 30, text: Array.from({ length: 40 }, (_, index) => `row-${index}`).join('\n') }],
      },
    ],
    estimatedTokens: 30,
  };
  const tui = { terminal: { rows: 30 }, requestRender: () => undefined, wheelScrollLines: 5 };
  const dialog = new ContextViewDialog(
    tui as never,
    theme,
    { matches: () => false } as never,
    { usage: longUsage, initial: buildSnapshot([], 'real-turn', new Date()) },
    () => undefined,
  );
  dialog.render(100);
  dialog.handleInput('\r'); // open the block stream
  dialog.render(100);
  dialog.handleInput('\r'); // open the truncated block's full content
  const firstContentLine = (lines: string[]) => lines.find(line => /row-\d+/.test(line)) ?? '';
  assert.match(firstContentLine(dialog.render(100)), /row-0/);
  dialog.handleInput('\u001b[<65;1;1M');
  assert.match(firstContentLine(dialog.render(100)), /row-5/);
});
