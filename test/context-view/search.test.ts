import { expect, test } from 'bun:test';
import { buildSearchPattern, findMatches, normalizeSearchText } from '../../src/extensions/context-view/ui/search';

test('literal case-insensitive Unicode matching escapes every regex metacharacter', () => {
  expect(findMatches('A.*+[x](y)?^$|{}\\ a.*+[x](y)?^$|{}\\', 'a.*+[x](y)?^$|{}\\')).toHaveLength(2);
  expect(findMatches('École école', 'ÉCOLE')).toEqual([
    { start: 0, end: 5 },
    { start: 6, end: 11 },
  ]);
});
test('query whitespace collapses; content normalization is optional', () => {
  expect(normalizeSearchText('  a\n\t b ')).toBe('a b');
  expect(findMatches('a\n  b', ' a b ')).toEqual([]);
  expect(findMatches('a\n  b', ' a b ', true)).toEqual([{ start: 0, end: 3 }]);
  expect(buildSearchPattern(' \n')).toBeUndefined();
  expect(findMatches('anything', '')).toEqual([]);
});
test('reusing a pattern does not leak lastIndex', () => {
  const pattern = buildSearchPattern('a');
  if (pattern === undefined) throw new Error('Expected nonempty pattern');
  pattern.lastIndex = 2;
  expect(findMatches('aaa', pattern)).toHaveLength(3);
  expect(findMatches('aaa', pattern)).toHaveLength(3);
});
