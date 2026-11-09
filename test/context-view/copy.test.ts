import { expect, test } from 'bun:test';
import { copyText, showCopyNotice } from '../../src/extensions/context-view/ui/copy';

test('copy normalizes line endings and boundary whitespace, retaining indentation', async () => {
  let copied = '';
  expect(
    await copyText('\r\n\n  hello\r\nworld \n\t', text => {
      copied = text;
    }),
  ).toEqual({ text: 'Copied 13 characters', tone: 'success', ttlMs: 3000 });
  expect(copied).toBe('  hello\nworld');
});
test('empty copy does not call clipboard', async () => {
  expect(
    await copyText('\n \t', () => {
      throw new Error('must not call');
    }),
  ).toEqual({ text: 'Nothing to copy', tone: 'warning', ttlMs: 5000 });
});
test('clipboard sync and async failures become notices', async () => {
  for (const clipboard of [
    () => {
      throw new Error('blocked');
    },
    async () => {
      throw new Error('blocked');
    },
  ]) {
    expect(await copyText('text', clipboard)).toEqual({ text: 'Copy failed: blocked', tone: 'error', ttlMs: 5000 });
  }
  expect(
    (
      await copyText('x', () => {
        throw 'unavailable';
      })
    ).text,
  ).toBe('Copy failed: unavailable');
});
test('notice adapter forwards all descriptor fields', () => {
  let args: unknown[] = [];
  showCopyNotice(
    {
      showNotice: (...values) => {
        args = values;
      },
    },
    { text: 'ok', tone: 'success', ttlMs: 3000 },
  );
  expect(args).toEqual(['ok', 'success', 3000]);
});
