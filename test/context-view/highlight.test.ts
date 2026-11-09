import { expect, test } from 'bun:test';
import { stripTerminalSequences } from '@earendil-works/pi-tui';
import { CURRENT_MATCH_SGR, highlightLine, MATCH_SGR, matchColumns } from '../../src/extensions/context-view/ui/highlight';

test('plain lines highlight at exclusive column offsets and distinguish current', () => {
  expect(
    highlightLine(
      'abc def',
      [
        { start: 0, end: 3 },
        { start: 4, end: 7 },
      ],
      1,
    ),
  ).toBe(`${MATCH_SGR}abc\x1b[0m ${CURRENT_MATCH_SGR}def\x1b[0m`);
});
test('styled lines restore existing colors after the highlighted span', () => {
  const line = '\x1b[31mabcdef\x1b[0m';
  expect(highlightLine(line, [{ start: 1, end: 3 }])).toBe(`\x1b[31ma${MATCH_SGR}bc\x1b[0m\x1b[31mdef\x1b[0m`);
});
test('resets and nested styles inside a match reapply highlighting and restore state', () => {
  const line = '\x1b[31ma\x1b[1mb\x1b[0mcdef';
  const highlighted = highlightLine(line, [{ start: 0, end: 4, current: true }]);
  expect(stripTerminalSequences(highlighted)).toBe('abcdef');
  expect(highlighted).toContain(`\x1b[0m${CURRENT_MATCH_SGR}cd`);
  expect(highlighted).toEndWith('\x1b[0m\x1b[31m\x1b[1m\x1b[0mef');
});
test('invalid escape sequences or ranges leave the original unhighlighted', () => {
  for (const line of ['abc\x1b[31', 'abc\x1b[2J', 'a\tb']) {
    expect(highlightLine(line, [{ start: 0, end: 1 }])).toBe(line);
  }
  expect(highlightLine('界x', [{ start: 1, end: 2 }])).toBe('界x');
});
test('Unicode offsets convert to visible columns including combining characters', () => {
  expect(matchColumns('界e\u0301x', { start: 1, end: 3 })).toEqual({ start: 2, end: 3 });
  expect(stripTerminalSequences(highlightLine('界e\u0301x', [{ start: 2, end: 3 }]))).toBe('界e\u0301x');
});
