import { describe, expect, test } from 'bun:test';
import { EMPTY_BAR_ICON, FILLED_BAR_ICON } from '../../src/extensions/custom-footer/constants';
import { clampPercent, renderProgressBar } from '../../src/extensions/custom-footer/progress-bar';

describe('custom-footer progress bar', () => {
  test('clamps percentages', () => {
    expect(clampPercent(-10)).toBe(0);
    expect(clampPercent(42.5)).toBe(42.5);
    expect(clampPercent(120)).toBe(100);
    expect(clampPercent(Number.NaN)).toBe(0);
  });

  test('renders filled and empty cells using rounded fill math', () => {
    expect(renderProgressBar(0)).toEqual({ filled: '', empty: EMPTY_BAR_ICON.repeat(10) });
    expect(renderProgressBar(50)).toEqual({ filled: FILLED_BAR_ICON.repeat(5), empty: EMPTY_BAR_ICON.repeat(5) });
    expect(renderProgressBar(66)).toEqual({ filled: FILLED_BAR_ICON.repeat(7), empty: EMPTY_BAR_ICON.repeat(3) });
    expect(renderProgressBar(100)).toEqual({ filled: FILLED_BAR_ICON.repeat(10), empty: '' });
  });

  test('supports custom widths and edge cases', () => {
    expect(renderProgressBar(25, 4)).toEqual({ filled: FILLED_BAR_ICON, empty: EMPTY_BAR_ICON.repeat(3) });
    expect(renderProgressBar(1000, 4)).toEqual({ filled: FILLED_BAR_ICON.repeat(4), empty: '' });
    expect(renderProgressBar(50, 0)).toEqual({ filled: '', empty: '' });
    expect(renderProgressBar(50, -5)).toEqual({ filled: '', empty: '' });
  });
});
