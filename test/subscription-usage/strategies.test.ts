import { expect, test } from 'bun:test';
import { AnthropicOauthUsageStrategy, computePace, OpenAiCodexUsageStrategy, OpenCodeGoUsageStrategy, SUBSCRIPTION_PROVIDERS } from '../../src/libs/subscription-usage';

test('supported provider labels come from the strategies', () => {
  expect(SUBSCRIPTION_PROVIDERS).toEqual([
    { provider: 'anthropic', label: new AnthropicOauthUsageStrategy().label },
    { provider: 'openai-codex', label: new OpenAiCodexUsageStrategy().label },
    { provider: 'opencode-go', label: new OpenCodeGoUsageStrategy().label },
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

const goStrategy = new OpenCodeGoUsageStrategy();
function goFixture() {
  return {
    access: {
      startsAt: '2026-09-29T18:47:39Z',
      endsAt: '2026-10-29T18:47:39Z',
      meters: {
        fiveHour: { startsAt: '2026-10-12T00:00:00Z', resetsAt: '2026-10-12T05:00:00Z', limitMicroCents: '1200000000', usedMicroCents: '22118184' },
        week: { startsAt: '2026-10-12T00:00:00Z', resetsAt: '2026-10-19T00:00:00Z', limitMicroCents: '2400000000', usedMicroCents: '57600000' },
        month: { resetsAt: '2026-10-29T18:47:39Z', limitMicroCents: '6000000000', usedMicroCents: '90000000' },
      },
    },
  };
}

test('GO requests status with a bearer API key', () => {
  const request = goStrategy.request({ token: 'go-key' });
  expect(request.url).toBe('https://opencode.ai/console/api/go/status');
  expect(request.method).toBe('GET');
  expect(request.headers.get('Authorization')).toBe('Bearer go-key');
});

test('GO maps string amounts, reset dates and response-derived durations', () => {
  const windows = goStrategy.parse(goFixture());
  expect(windows.map(window => window.label)).toEqual(['5h', 'Week', 'Month']);
  expect(windows[0]?.usedPercent).toBeCloseTo(1.843182, 6);
  expect(windows[1]?.usedPercent).toBeCloseTo(2.4);
  expect(windows[2]?.usedPercent).toBeCloseTo(1.5);
  expect(windows.map(window => window.windowSeconds)).toEqual([18000, 604800, 30 * 86400]);
  expect(windows.map(window => window.resetAt)).toEqual([
    new Date('2026-10-12T05:00:00Z'), new Date('2026-10-19T00:00:00Z'), new Date('2026-10-29T18:47:39Z'),
  ]);
  const fixture = goFixture();
  fixture.access.meters.fiveHour.startsAt = '2026-10-12T01:00:00Z';
  expect(goStrategy.parse(fixture)[0]?.windowSeconds).toBe(14400);
});

test('GO falls back for unusable starts, but never guesses the billing month', () => {
  for (const start of [undefined, 'invalid', '2027-01-01T00:00:00Z', '2026-10-12T05:00:00Z']) {
    const fixture = goFixture();
    const windows = goStrategy.parse({ access: {
      ...fixture.access,
      startsAt: undefined,
      meters: {
        ...fixture.access.meters,
        fiveHour: { ...fixture.access.meters.fiveHour, startsAt: start },
        week: { ...fixture.access.meters.week, startsAt: undefined },
      },
    } });
    expect(windows.map(window => window.windowSeconds)).toEqual([18000, 604800, undefined]);
    expect(windows[2]?.label).toBe('Month');
    expect(computePace(windows[2]!)).toBeUndefined();
  }
});

test('GO skips only unusable meters and accepts numeric zero usage', () => {
  const fixture = goFixture();
  for (const patch of [
    { limitMicroCents: '0' }, { limitMicroCents: '-1' }, { limitMicroCents: undefined },
    { usedMicroCents: undefined }, { usedMicroCents: null }, { usedMicroCents: '' },
    { usedMicroCents: ' ' }, { usedMicroCents: 'bad' }, { usedMicroCents: false },
    { resetsAt: undefined }, { resetsAt: 'bad' },
  ]) {
    const windows = goStrategy.parse({ access: { ...fixture.access, meters: {
      ...fixture.access.meters, fiveHour: { ...fixture.access.meters.fiveHour, ...patch },
    } } });
    expect(windows.map(window => window.label)).toEqual(['Week', 'Month']);
  }
  expect(goStrategy.parse({ access: { meters: {
    fiveHour: { ...fixture.access.meters.fiveHour, limitMicroCents: 100, usedMicroCents: 0 },
  } } })[0]?.usedPercent).toBe(0);
  for (const json of [null, {}, { access: {} }, { access: { meters: {} } }]) expect(goStrategy.parse(json)).toEqual([]);
});
