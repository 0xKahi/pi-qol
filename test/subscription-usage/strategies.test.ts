import { expect, test } from 'bun:test';
import { AnthropicOauthUsageStrategy, OpenAiCodexUsageStrategy, SUBSCRIPTION_PROVIDERS } from '../../src/libs/subscription-usage';

test('supported provider labels come from the strategies', () => {
  expect(SUBSCRIPTION_PROVIDERS).toEqual([
    { provider: 'anthropic', label: new AnthropicOauthUsageStrategy().label },
    { provider: 'openai-codex', label: new OpenAiCodexUsageStrategy().label },
  ]);
});

test('Claude parses labels, percentages, reset dates and durations', () => {
  const strategy = new AnthropicOauthUsageStrategy();
  expect(strategy.parse({ five_hour: { utilization: 25, resets_at: '2026-01-01T00:00:00Z' }, seven_day: { utilization: 50 } })).toEqual([
    { label: '5h', usedPercent: 25, resetAt: new Date('2026-01-01T00:00:00Z'), windowSeconds: 18000 },
    { label: 'Week', usedPercent: 50, resetAt: undefined, windowSeconds: 604800 },
  ]);
  expect(strategy.parse({})).toEqual([]);
  expect(strategy.parse(null)).toEqual([]);
  expect(strategy.parse({ five_hour: { utilization: 10, resets_at: 'bad' } })[0]?.resetAt).toBeUndefined();
  expect(strategy.request({ token: 'host-token' }).headers.get('Authorization')).toBe('Bearer host-token');
});

test('Codex retains all windows, durations and named additional limits', () => {
  const strategy = new OpenAiCodexUsageStrategy();
  const windows = strategy.parse({
    rate_limit: { primary_window: { used_percent: 20, limit_window_seconds: 18000, reset_at: 100 }, secondary_window: { used_percent: 30 } },
    additional_rate_limits: [{ limit_name: 'Review', rate_limit: { primary_window: { used_percent: 40, limit_window_seconds: 604800 } } }],
  });
  expect(windows).toEqual([
    { label: '5h', usedPercent: 20, resetAt: new Date(100000), windowSeconds: 18000 },
    { label: 'Day', usedPercent: 30, resetAt: undefined, windowSeconds: 86400 },
    { label: 'Review Week', usedPercent: 40, resetAt: undefined, windowSeconds: 604800 },
  ]);
  expect(strategy.parse({ rate_limit: { primary_window: { used_percent: 10 } } })[0]?.windowSeconds).toBe(10800);
  expect(strategy.parse(null)).toEqual([]);
  const request = strategy.request({ token: 'host-token', accountId: 'account' });
  expect(request.headers.get('Authorization')).toBe('Bearer host-token');
  expect(request.headers.get('ChatGPT-Account-Id')).toBe('account');
});
