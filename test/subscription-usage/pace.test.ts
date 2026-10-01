import { expect, test } from 'bun:test';
import { computePace, formatResetDescription } from '../../src/libs/subscription-usage';

test('pace follows elapsed duration and usage', () => {
  const day = 86400;
  const ahead = computePace({ label: 'Week', usedPercent: 81, windowSeconds: 7 * day, resetAt: new Date(3 * day * 1000) }, 0);
  expect(ahead?.elapsedPercent).toBeCloseTo(57.14, 2);
  expect(ahead?.pace).toBe('ahead');
  expect(computePace({ label: '5h', usedPercent: 30, windowSeconds: 18000, resetAt: new Date(7200000) }, 0)).toEqual({ elapsedPercent: 60, pace: 'on-pace' });
  expect(computePace({ label: '5h', usedPercent: 100, windowSeconds: 18000, resetAt: new Date(7200000) }, 0)?.pace).toBe('limit');
  expect(computePace({ label: 'unknown', usedPercent: 10, windowSeconds: 18000 })).toBeUndefined();
  expect(computePace({ label: 'unknown', usedPercent: 10, resetAt: new Date() })).toBeUndefined();
  expect(computePace({ label: 'future', usedPercent: 0, windowSeconds: 1, resetAt: new Date(5000) }, 0)?.elapsedPercent).toBe(0);
  expect(computePace({ label: 'past', usedPercent: 0, windowSeconds: 1, resetAt: new Date(0) }, 5000)?.elapsedPercent).toBe(100);
});

test('reset formatting', () => {
  expect(formatResetDescription(new Date(0), 0)).toBe('now');
  expect(formatResetDescription(new Date(60000), 0)).toBe('1m');
  expect(formatResetDescription(new Date(7980000), 0)).toBe('2h13m');
  expect(formatResetDescription(new Date(90000000), 0)).toBe('1d1h');
});
