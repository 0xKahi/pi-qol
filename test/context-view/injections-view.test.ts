import assert from 'node:assert/strict';
import { test } from 'node:test';

import type { Theme } from '@earendil-works/pi-coding-agent';

import type { InitialSnapshot, InjectionItem } from '../../src/extensions/context-view/model.ts';
import { InjectionsView } from '../../src/extensions/context-view/ui/injections-view.ts';
import type { ModalLayer } from '../../src/libs/modal/index.ts';

const theme = {
  fg: (_color: string, text: string) => text,
  bold: (text: string) => text,
} as Theme;

function item(id: string, tokens: number, overrides: Partial<InjectionItem> = {}): InjectionItem {
  return {
    id,
    phase: 'initial',
    kind: 'message',
    source: { id: 'pi', label: 'pi', native: true },
    label: id,
    chars: tokens * 4,
    tokens,
    text: `${id} body`,
    ...overrides,
  };
}

function snapshot(items: InjectionItem[]): InitialSnapshot {
  const totalTokens = items.reduce((sum, entry) => sum + entry.tokens, 0);
  return {
    origin: 'real-turn',
    capturedAt: new Date('2026-07-10T12:00:00Z'),
    groups: [{ source: { id: 'pi', label: 'pi', native: true }, items, totalTokens }],
    totalTokens,
  };
}

/** Capture the layer an Enter press pushes above the tab. */
function captureLayer(view: InjectionsView): () => ModalLayer | undefined {
  let captured: ModalLayer | undefined;
  view.attach({ pushLayer: layer => (captured = layer) });
  return () => captured;
}

const refItem = item('system-prompt', 20, {
  label: 'System Prompt',
  text: 'Guidelines:',
  injectedReferences: [
    {
      offset: 'Guidelines:'.length,
      text: '\n- Use search',
      itemId: 'system-prompt',
      source: { id: 'web', label: 'npm:web', native: false },
      tool: 'search',
      attribution: 'guess',
    },
  ],
});
const jsonItem = item('definition', 8, {
  label: 'Definition',
  text: 'read({"path":"x"})',
  jsonSpan: { start: 5, end: 17 },
});

test('InjectionsView marks dropped and moved rows and explains both in its legend', () => {
  const view = new InjectionsView(theme, {
    snapshot: snapshot([
      item('base', 10),
      item('guidelines', 0, { label: 'Guidelines', dropped: true }),
      item('tools', 9, { label: 'Available Tools', moved: true }),
    ]),
  });
  const text = view.render(120, 40).join('\n');

  assert.match(text, /Guidelines \.+ 0 · Dropped/);
  assert.match(text, /Available Tools \.+ 9 · Moved/);
  // The list explains exactly the markers its rows carry, below its own sentence.
  assert.match(text, /- Dropped parts were replaced by a custom system prompt/);
  assert.match(text, /- Moved blocks appear in a different position/);
  assert.doesNotMatch(text, /- Highlighted parts/);
});

test('InjectionsView moves the selection one row per wheel notch', () => {
  const view = new InjectionsView(theme, { snapshot: snapshot([item('base', 10), item('second', 5)]) });
  view.render(120, 40);
  const before = view.render(120, 40).find(line => line.includes('→'));
  view.handleInput('\u001b[<65;1;1M');
  const after = view.render(120, 40).find(line => line.includes('→'));
  assert.notEqual(after, before);
});

test('InjectionsView preview restores attributed references and expands JSON', () => {
  const view = new InjectionsView(theme, { snapshot: snapshot([refItem, jsonItem]) });
  const layer = captureLayer(view);
  view.render(120, 40);

  view.handleNavigation('step-forward'); // select the attributed item
  view.handleNavigation('confirm');
  const reference = layer();
  assert.ok(reference !== undefined);
  const referenceText = reference.render(120, 40).join('\n');
  assert.ok(referenceText.includes('- Use search\u00A0<-\u00A0npm:web:search (guess)'));

  view.handleNavigation('step-forward'); // select the JSON item
  view.handleNavigation('confirm');
  const json = layer();
  assert.ok(json !== undefined);
  assert.match(json.render(120, 40).join('\n'), /"path": "x"/);
});

test('InjectionsView wheel scrolls a pushed preview instead of the list', () => {
  const long = item('long', 4, {
    label: 'Long',
    text: Array.from({ length: 60 }, (_, index) => `line ${index}`).join('\n'),
  });
  const view = new InjectionsView(theme, { snapshot: snapshot([long]) });
  const layer = captureLayer(view);
  view.render(120, 40);
  view.handleNavigation('step-forward');
  view.handleNavigation('confirm');
  const preview = layer();
  assert.ok(preview !== undefined);
  const first = preview.render(120, 20);
  preview.handleInput('\u001b[<65;1;1M');
  const second = preview.render(120, 20);
  assert.notDeepEqual(second, first);
});

test('InjectionsView preview honors a configured host wheel step', () => {
  const long = item('long', 4, {
    label: 'Long',
    text: Array.from({ length: 60 }, (_, index) => `line-${index}`).join('\n'),
  });
  const view = new InjectionsView(theme, { snapshot: snapshot([long]) }, 5);
  const layer = captureLayer(view);
  view.render(120, 20);
  view.handleNavigation('step-forward');
  view.handleNavigation('confirm');
  const preview = layer();
  assert.ok(preview !== undefined);

  const firstContentLine = (lines: string[]) => lines.find(line => /line-\d+/.test(line)) ?? '';
  assert.match(firstContentLine(preview.render(120, 15)), /line-0/);
  preview.handleInput('\u001b[<65;1;1M');
  assert.match(firstContentLine(preview.render(120, 15)), /line-5/);
});
