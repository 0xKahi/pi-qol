import assert from 'node:assert/strict';
import { test } from 'node:test';

import type { Theme } from '@earendil-works/pi-coding-agent';

import { droppedMarker, guessMarker, markerLegendLines, movedMarker } from '../../src/extensions/context-view/ui/markers.ts';

const theme = {
  fg: (_color: string, text: string) => text,
} as Theme;

test('markerLegendLines renders bullets in fixed order without duplicates', () => {
  const lines = markerLegendLines(theme, ['moved', 'dropped', 'guess', 'highlighted', 'dropped'], 300);

  assert.equal(lines.length, 4);
  assert.ok(lines.every(line => line.startsWith('  - ')));
  assert.match(lines[0] ?? '', /^ {2}- Highlighted parts are injected by extensions/);
  assert.match(lines[1] ?? '', /^ {2}- \(guess\) sources are inferred/);
  assert.match(lines[2] ?? '', /^ {2}- Dropped parts were replaced/);
  assert.match(lines[3] ?? '', /^ {2}- Moved blocks appear in a different position/);
});

test('markerLegendLines renders nothing when the frame shows no marker', () => {
  assert.deepEqual(markerLegendLines(theme, [], 300), []);
  assert.deepEqual(markerLegendLines(theme, ['guess'], 300).length, 1);
});

test('state markers name one accounting state after a token estimate', () => {
  assert.equal(droppedMarker(theme), ' · Dropped');
  assert.equal(movedMarker(theme), ' · Moved');
  assert.equal(guessMarker(theme), ' (guess)');
});
