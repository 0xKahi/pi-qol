import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BlockNavigator, layoutPreviewBlocks } from '../../src/extensions/context-view/ui/usage-preview.ts';

test('layoutPreviewBlocks separates blocks without assigning separator ownership', () => {
  assert.deepEqual(layoutPreviewBlocks([2, 3]), {
    extents: [{ start: 0, height: 2 }, { start: 3, height: 3 }],
    lines: [
      { blockIndex: 0, lineIndex: 0 }, { blockIndex: 0, lineIndex: 1 }, undefined,
      { blockIndex: 1, lineIndex: 0 }, { blockIndex: 1, lineIndex: 1 }, { blockIndex: 1, lineIndex: 2 },
    ],
  });
});

test('BlockNavigator moves by block and minimally reveals fitting blocks', () => {
  const navigator = new BlockNavigator();
  navigator.setExtent(layoutPreviewBlocks([3, 2, 4]), 5);
  assert.equal(navigator.stepForward(), true);
  assert.equal(navigator.selected, 1);
  assert.equal(navigator.offset, 1);
  assert.equal(navigator.stepForward(), true);
  assert.equal(navigator.selected, 2);
  assert.equal(navigator.offset, 6);
  assert.equal(navigator.stepBack(), true);
  assert.equal(navigator.selected, 1);
  assert.equal(navigator.offset, 4);
});

test('BlockNavigator scrolls inside oversized blocks before crossing edges', () => {
  const navigator = new BlockNavigator();
  navigator.setExtent(layoutPreviewBlocks([2, 7, 2]), 4);
  navigator.stepForward();
  assert.equal(navigator.selected, 1);
  assert.equal(navigator.offset, 3);
  for (const offset of [4, 5, 6]) {
    navigator.stepForward();
    assert.equal(navigator.selected, 1);
    assert.equal(navigator.offset, offset);
  }
  navigator.stepForward();
  assert.equal(navigator.selected, 2);
  navigator.stepBack();
  assert.equal(navigator.selected, 1);
  assert.equal(navigator.offset, 6);
});

test('BlockNavigator pages and reaches both stream boundary blocks', () => {
  const navigator = new BlockNavigator();
  navigator.setExtent(layoutPreviewBlocks([2, 2, 2, 2, 2]), 5);
  navigator.page(1);
  assert.equal(navigator.offset, 5);
  assert.equal(navigator.selected, 2);
  navigator.page(1);
  assert.equal(navigator.offset, 9);
  navigator.page(1);
  assert.equal(navigator.selected, 4);
  assert.equal(navigator.page(1), false);
  navigator.moveToFirst();
  assert.equal(navigator.selected, 0);
  assert.equal(navigator.offset, 0);
});

test('BlockNavigator handles empty streams and geometry changes', () => {
  const navigator = new BlockNavigator();
  navigator.setExtent(layoutPreviewBlocks([]), 5);
  assert.equal(navigator.blockCount, 0);
  assert.equal(navigator.stepForward(), false);
  assert.equal(navigator.page(1), false);
  navigator.setExtent(layoutPreviewBlocks([2, 2, 2]), 3);
  navigator.moveToLast();
  assert.equal(navigator.selected, 2);
  assert.equal(navigator.offset, navigator.maxOffset);
  navigator.setExtent(layoutPreviewBlocks([1, 1]), 10);
  assert.equal(navigator.selected, 1);
  assert.equal(navigator.offset, 0);
});
