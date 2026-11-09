import assert from 'node:assert/strict';
import { test } from 'node:test';

import type { Theme } from '@earendil-works/pi-coding-agent';
import type { TuiMouseEvent } from '@earendil-works/pi-tui';
import type { CopyServices } from '../../src/extensions/context-view/ui/copy';

const copy: CopyServices = { notices: { showNotice() {} }, clipboard() {} };
const wheel = (wheelDelta: number): TuiMouseEvent => ({
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
});

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
  const view = new InjectionsView(
    theme,
    {
      snapshot: snapshot([
        item('base', 10),
        item('guidelines', 0, { label: 'Guidelines', dropped: true }),
        item('tools', 9, { label: 'Available Tools', moved: true }),
      ]),
    },
    copy,
  );
  const text = view.render(120, 40).join('\n');

  assert.match(text, /Guidelines \.+ 0 · Dropped/);
  assert.match(text, /Available Tools \.+ 9 · Moved/);
  // The list explains exactly the markers its rows carry, below its own sentence.
  assert.match(text, /- Dropped parts were replaced by a custom system prompt/);
  assert.match(text, /- Moved blocks appear in a different position/);
  assert.doesNotMatch(text, /- Highlighted parts/);
});

test('InjectionsView moves the selection by the normalized wheel delta', () => {
  const view = new InjectionsView(theme, { snapshot: snapshot([item('base', 10), item('second', 5)]) }, copy);
  view.render(120, 40);
  const before = view.render(120, 40).find(line => line.includes('→'));
  assert.deepEqual(view.handleMouse(wheel(1)), { handled: true });
  const after = view.render(120, 40).find(line => line.includes('→'));
  assert.notEqual(after, before);
});

test('InjectionsView preview restores attributed references and expands JSON', () => {
  const view = new InjectionsView(theme, { snapshot: snapshot([refItem, jsonItem]) }, copy);
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
  const view = new InjectionsView(theme, { snapshot: snapshot([long]) }, copy);
  const layer = captureLayer(view);
  view.render(120, 40);
  view.handleNavigation('step-forward');
  view.handleNavigation('confirm');
  const preview = layer();
  assert.ok(preview !== undefined);
  const first = preview.render(120, 20);
  preview.handleMouse?.(wheel(3));
  const second = preview.render(120, 20);
  assert.notDeepEqual(second, first);
});

test('InjectionsView preview honors the delivered host wheel delta', () => {
  const long = item('long', 4, {
    label: 'Long',
    text: Array.from({ length: 60 }, (_, index) => `line-${index}`).join('\n'),
  });
  const view = new InjectionsView(theme, { snapshot: snapshot([long]) }, copy);
  const layer = captureLayer(view);
  view.render(120, 20);
  view.handleNavigation('step-forward');
  view.handleNavigation('confirm');
  const preview = layer();
  assert.ok(preview !== undefined);

  const firstContentLine = (lines: string[]) => lines.find(line => /line-\d+/.test(line)) ?? '';
  assert.match(firstContentLine(preview.render(120, 15)), /line-0/);
  preview.handleMouse?.(wheel(5));
  assert.match(firstContentLine(preview.render(120, 15)), /line-5/);
});

test('Injections filter captures j/q, toggles mode, confirms, clears, and keeps exact height', () => {
  const view = new InjectionsView(theme, { snapshot: snapshot([item('jq', 10, { text: 'special content' }), item('other', 5)]) }, copy);
  assert.equal(view.render(100, 18).length, 18);
  view.handleInput('/');
  assert.equal(view.capturesInput(), true);
  view.handleInput('j');
  view.handleInput('q');
  const text = view.render(100, 18).join('\n');
  assert.match(text, /Filter \(Name\): jq/);
  assert.doesNotMatch(text, /other/);
  assert.equal(view.render(100, 18).length, 18);
  view.handleInput('\t');
  assert.match(view.render(100, 18).join('\n'), /No contributions match/);
  assert.match(view.render(100, 18).join('\n'), /Filter \(Content\)/);
  view.handleInput('\x1b[Z');
  assert.match(view.render(100, 18).join('\n'), /Filter \(Name\)/);
  view.handleInput('\r');
  assert.equal(view.capturesInput(), false);
  assert.match(view.render(100, 18).join('\n'), /Filter \(Name\): jq/);
  view.handleInput('/');
  view.handleInput('\x1b');
  assert.equal(view.capturesInput(), false);
  assert.match(view.render(100, 18).join('\n'), /other/);
  assert.doesNotMatch(view.render(100, 18).join('\n'), /Filter \(/);
  for (const height of [0, 1, 5, 18, 40]) {
    assert.equal(view.render(100, height).length, height);
    view.handleNavigation('last');
    assert.equal(view.render(100, height).length, height);
  }
});

test('Injections list copies selected raw item, filtered group, and preview full raw content', async () => {
  const copied: string[] = [];
  const services: CopyServices = {
    clipboard: text => {
      copied.push(text);
    },
    notices: { showNotice() {} },
  };
  const view = new InjectionsView(
    theme,
    { snapshot: snapshot([item('keep', 1, { text: 'raw keep' }), item('hidden', 1, { text: 'raw hidden' })]) },
    services,
  );
  const getLayer = captureLayer(view);
  view.render(100, 18);
  view.handleInput('/');
  view.handleInput('keep');
  view.handleInput('\r');
  view.handleInput('y'); // first visible row is its source group
  await Promise.resolve();
  assert.deepEqual(copied, ['raw keep']);
  view.handleNavigation('step-forward');
  view.handleInput('y');
  view.handleNavigation('confirm');
  const layer = getLayer();
  assert.ok(layer);
  layer.handleInput('y');
  await Promise.resolve();
  assert.deepEqual(copied, ['raw keep', 'raw keep', 'raw keep']);
});

test('empty filtered list clears copy selection and normalized wheels clamp selection', async () => {
  const copied: string[] = [];
  const notices: string[] = [];
  const view = new InjectionsView(
    theme,
    { snapshot: snapshot([item('first', 1), item('second', 1), item('third', 1)]) },
    {
      clipboard: text => {
        copied.push(text);
      },
      notices: {
        showNotice: text => {
          notices.push(text);
        },
      },
    },
  );
  view.render(100, 20);
  view.handleMouse(wheel(3));
  assert.match(view.render(100, 20).find(line => line.includes('→')) ?? '', /third/);
  view.handleMouse(wheel(-99));
  assert.match(view.render(100, 20).find(line => line.includes('→')) ?? '', /pi/);
  assert.equal(view.handleMouse({ ...wheel(0), type: 'move' }), undefined);
  view.handleInput('/');
  view.handleInput('absent');
  view.handleInput('\r');
  view.handleInput('y');
  await Promise.resolve();
  await Promise.resolve();
  assert.deepEqual(copied, []);
  assert.deepEqual(notices, ['Nothing to copy']);
  assert.equal(
    view.render(100, 20).some(line => line.includes('→')),
    false,
  );
});

test('group copy retains intact aggregate raw text but excludes filtered-out children', async () => {
  const copied: string[] = [];
  const children = [item('keep-child', 1, { text: 'visible payload' }), item('hide-child', 1, { text: 'hidden payload' })];
  const aggregate = item('aggregate', 2, { text: 'raw wrapper\nvisible payload\nhidden payload', children });
  const view = new InjectionsView(
    theme,
    { snapshot: snapshot([aggregate]) },
    {
      clipboard: text => {
        copied.push(text);
      },
      notices: { showNotice() {} },
    },
  );
  view.render(100, 20);
  view.handleInput('y');
  await Promise.resolve();
  assert.deepEqual(copied, [aggregate.text]);
  view.handleInput('/');
  view.handleInput('keep-child');
  view.handleInput('\r');
  view.handleInput('y');
  await Promise.resolve();
  assert.deepEqual(copied, [aggregate.text, 'visible payload']);
});
