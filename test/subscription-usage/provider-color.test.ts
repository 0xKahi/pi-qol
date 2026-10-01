import { expect, test } from 'bun:test';
import { PROVIDER_USAGE_COLORS, providerUsageColor } from '../../src/libs/subscription-usage';

test('fixed provider colors are shared by usage consumers', () => {
  expect(PROVIDER_USAGE_COLORS).toEqual({ anthropic: '#D97706', 'openai-codex': '#10B981' });
  expect(providerUsageColor('anthropic')).toBe('#D97706');
  expect(providerUsageColor('openai-codex')).toBe('#10B981');
});
