import { describe, expect, test } from 'bun:test';
import { MAX_TITLE_LENGTH } from '../../src/extensions/auto-session-name/constants';
import { AutoSessionNameTitleGenerator } from '../../src/extensions/auto-session-name/title-generator';

describe('cleanTitle', () => {
  test('strips think blocks', () => {
    expect(AutoSessionNameTitleGenerator.cleanTitle('<think>private reasoning</think>Useful title')).toBe('Useful title');
  });

  test('picks first non-empty trimmed line', () => {
    expect(AutoSessionNameTitleGenerator.cleanTitle('  \n  First title  \nSecond title')).toBe('First title');
  });

  test('returns empty for empty or only-think input', () => {
    expect(AutoSessionNameTitleGenerator.cleanTitle('   \n')).toBe('');
    expect(AutoSessionNameTitleGenerator.cleanTitle('<think>only reasoning</think>')).toBe('');
  });

  test('caps titles longer than 100 chars with ellipsis', () => {
    const title = AutoSessionNameTitleGenerator.cleanTitle('x'.repeat(MAX_TITLE_LENGTH + 10));
    expect(title).toHaveLength(MAX_TITLE_LENGTH);
    expect(title.endsWith('…')).toBe(true);
  });

  test('unwraps surrounding quotes and backticks', () => {
    expect(AutoSessionNameTitleGenerator.cleanTitle('"Quoted title"')).toBe('Quoted title');
    expect(AutoSessionNameTitleGenerator.cleanTitle('`Backtick title`')).toBe('Backtick title');
  });
});
