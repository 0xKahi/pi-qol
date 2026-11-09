import assert from 'node:assert/strict';
import { test } from 'node:test';

import type { Theme } from '@earendil-works/pi-coding-agent';
import type { TuiMouseEvent } from '@earendil-works/pi-tui';
import type { ContextUsageSnapshot, UsageCategory, UsagePreviewEntry } from '../../src/extensions/context-view/model.ts';
import { buildSnapshot } from '../../src/extensions/context-view/model.ts';
import { ContextViewDialog } from '../../src/extensions/context-view/ui/context-view-dialog.ts';
import { UsageView } from '../../src/extensions/context-view/ui/usage-view.ts';
import type { ModalLayer } from '../../src/libs/modal/index.ts';

function wheel(wheelDelta: number): TuiMouseEvent {
  return {
    type: 'wheel',
    button: 'none',
    x: 0,
    y: 0,
    screenX: 0,
    screenY: 0,
    width: 120,
    height: 40,
    shift: false,
    alt: false,
    ctrl: false,
    wheelDelta,
  };
}

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
  view.handleMouse(wheel(1));
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

test('UsageBlockLayer scrolls one block per wheel notch through normalized wheel events', () => {
  const view = new UsageView(theme, { usage: usage() });
  const layer = captureLayer(view);
  view.render(120, 40);
  view.handleNavigation('confirm');
  const preview = layer();
  assert.ok(preview !== undefined);
  view.render(120, 40);
  // A fresh preview starts on the first block; a notch down scrolls its content.
  const first = preview.render(120, 40);
  preview.handleMouse?.(wheel(1));
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

test('ContextViewDialog forwards the host wheel delta into usage full-content previews', () => {
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
  const tui = { terminal: { rows: 30 }, requestRender: () => undefined };
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
  dialog.handleMouse(wheel(5));
  assert.match(firstContentLine(dialog.render(100)), /row-5/);
});

test('Usage percentage basis toggles independently of zoom and leaves header window-based', () => {
  const snapshot: ContextUsageSnapshot = {
    ...usage(),
    estimatedTokens: 50,
    reported: { tokens: 100, percent: 10, contextWindow: 1000 },
    autoCompactReserveTokens: 100,
    categories: [
      { id: 'one', label: 'One', tokens: 20 },
      { id: 'two', label: 'Two', tokens: 30 },
    ],
  };
  const view = new UsageView(theme, { usage: snapshot });
  let text = view.render(120, 40).join('\n');
  assert.match(text, /% of window/);
  assert.match(text.split('\n').find(line => line.includes('■ One')) ?? '', /2%/);
  assert.ok(view.hints().some(([key]) => key === 'p'));
  view.handleInput('p');
  text = view.render(120, 40).join('\n');
  assert.match(text, /% of used/);
  assert.match(text.split('\n').find(line => line.includes('■ One')) ?? '', /40%/);
  assert.match(text, /100\/1k \(10%\)/);
  for (const label of ['Auto-Compact Buffer', 'Free Space']) {
    assert.ok(
      !text
        .split('\n')
        .find(line => line.includes(label))
        ?.includes('%'),
    );
  }
  view.handleInput('z');
  assert.match(view.render(120, 40).join('\n'), /% of used/);
  view.handleInput('p');
  assert.match(view.render(120, 40).join('\n'), /% of window/);
  assert.match(new UsageView(theme, { usage: snapshot }).render(120, 40).join('\n'), /% of window/);
});

test('Usage percentages omit unavailable denominators and p is inert when both are unavailable', () => {
  const unknown: ContextUsageSnapshot = { ...usage(), reported: undefined };
  const view = new UsageView(theme, { usage: unknown });
  assert.ok(
    !view
      .render(120, 40)
      .find(line => line.includes('■ System Prompt'))
      ?.includes('%'),
  );
  view.handleInput('p');
  assert.match(view.render(120, 40).find(line => line.includes('■ System Prompt')) ?? '', /80%/);

  const zero = new UsageView(theme, { usage: { ...usage(), categories: [], estimatedTokens: 0, reported: { contextWindow: 0 } } });
  assert.ok(!zero.hints().some(([key]) => key === 'p'));
  zero.handleInput('p');
  assert.match(zero.render(120, 40).join('\n'), /% of window/);

  const noUsed = new UsageView(theme, { usage: { ...usage(), estimatedTokens: 0 } });
  noUsed.handleInput('p');
  assert.ok(
    !noUsed
      .render(120, 40)
      .find(line => line.includes('■ System Prompt'))
      ?.includes('%'),
  );
});

test('Usage category copy includes complete raw entries in chronological order and reports empty categories', async () => {
  const copied: string[] = [];
  const notices: string[] = [];
  const copy = {
    clipboard: (text: string) => {
      copied.push(text);
    },
    notices: {
      showNotice: (text: string) => {
        notices.push(text);
      },
    },
  };
  const snapshot: ContextUsageSnapshot = {
    ...usage(),
    categories: [
      {
        id: 'tool-output',
        label: 'Tool Output',
        tokens: 3,
        children: [
          { id: 'late', label: 'Late', tokens: 1, entries: [{ timestamp: 20, breadcrumb: ['late'], tokens: 1, text: 'complete late' }] },
          { id: 'early', label: 'Early', tokens: 2, entries: [{ timestamp: 10, breadcrumb: ['early'], tokens: 2, text: 'complete early' }] },
        ],
      },
      { id: 'empty', label: 'Empty', tokens: 0 },
    ],
  };
  const view = new UsageView(theme, { usage: snapshot }, copy);
  view.handleInput('y');
  await Bun.sleep(0);
  assert.deepEqual(copied, ['complete early\n\ncomplete late']);
  assert.match(notices.at(-1) ?? '', /Copied/);
  view.handleNavigation('last');
  view.handleInput('y');
  await Bun.sleep(0);
  assert.equal(notices.at(-1), 'Nothing to copy');
  const freeOnly = new UsageView(theme, { usage: { ...snapshot, categories: [], autoCompactReserveTokens: 10 } }, copy);
  freeOnly.handleInput('y');
  await Bun.sleep(0);
  assert.equal(notices.at(-1), 'Nothing to copy');
  assert.equal(copied.length, 1);
});

test('Usage block and complete-content preview copy raw full text and search remains unbound in block stream', async () => {
  const copied: string[] = [];
  const copy = {
    clipboard: (text: string) => {
      copied.push(text);
    },
    notices: { showNotice: () => undefined },
  };
  const text = Array.from({ length: 50 }, (_, index) => `full line ${index}`).join('\n');
  const view = new UsageView(
    theme,
    { usage: { ...usage(), categories: [{ id: 'long', label: 'Long', tokens: 20, entries: [{ breadcrumb: ['long'], text, tokens: 20 }] }] } },
    copy,
  );
  const layers: ModalLayer[] = [];
  view.attach({
    pushLayer: layer => {
      layers.push(layer);
    },
  });
  view.handleNavigation('confirm');
  const block = layers[0];
  assert.ok(block);
  const rendered = block.render(100, 14);
  block.handleInput('/');
  assert.deepEqual(block.render(100, 14), rendered);
  assert.ok(!block.capturesInput?.());
  block.handleInput('y');
  await Bun.sleep(0);
  assert.equal(copied[0], text);
  assert.ok(block.hints().some(([key]) => key === 'y'));
  block.handleNavigation('confirm');
  const full = layers[1];
  assert.ok(full);
  full.render(100, 14);
  full.handleInput('y');
  await Bun.sleep(0);
  assert.equal(copied[1], text);
  full.handleInput('/');
  assert.equal(full.capturesInput?.(), true);
});
