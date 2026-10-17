import { expect, test } from 'bun:test';
import { pickSubscriptionUsageWindow, resolveSupportedProvider, SUBSCRIPTION_USAGE_TTL_MS, SubscriptionUsageCache, type UsageResult } from '../../src/libs/subscription-usage';

const settle = () => new Promise(resolve => setTimeout(resolve, 0));
test('shared cache deduplicates, honors TTL, forces refresh and retains success on failure', async () => {
  let now = 0;
  let calls = 0;
  let complete: ((result: UsageResult) => void) | undefined;
  const cache = new SubscriptionUsageCache({ ttlMs: 100, now: () => now, api: { fetchUsage: () => { calls++; return new Promise(resolve => { complete = resolve; }); } } });
  let notifications = 0;
  const unsubscribe = cache.subscribe(() => notifications++);
  cache.ensureFresh('anthropic');
  cache.ensureFresh('anthropic');
  cache.refresh('anthropic');
  await settle();
  expect(calls).toBe(1);
  expect(cache.get('anthropic')?.inFlight).toBe(true);
  const windows = [{ label: '5h', usedPercent: 30 }];
  complete?.({ status: 'ok', label: 'Claude', windows });
  await settle();
  expect(notifications).toBe(1);
  expect(cache.get('anthropic')?.lastSuccess).toEqual({ windows, fetchedAt: 0 });
  now = 50;
  expect(cache.ensureFresh('anthropic')?.result?.status).toBe('ok');
  await settle();
  expect(calls).toBe(1);
  cache.refresh('anthropic');
  await settle();
  expect(calls).toBe(2);
  complete?.({ status: 'expired', label: 'Claude' });
  await settle();
  expect(cache.get('anthropic')?.result?.status).toBe('expired');
  expect(cache.get('anthropic')?.lastSuccess).toEqual({ windows, fetchedAt: 0 });
  unsubscribe();
  now = 151;
  cache.ensureFresh('anthropic');
  await settle();
  expect(calls).toBe(3);
  complete?.({ status: 'network', label: 'Claude' });
  await settle();
  expect(notifications).toBe(2);
});

test('default TTL uses the shared lib constant', async () => {
  let now = 0;
  let calls = 0;
  const cache = new SubscriptionUsageCache({ now: () => now, api: { fetchUsage: async () => {
    calls++;
    return { status: 'no-auth', label: 'Claude' };
  } } });
  cache.ensureFresh('anthropic');
  await settle();
  now = SUBSCRIPTION_USAGE_TTL_MS;
  cache.ensureFresh('anthropic');
  await settle();
  expect(calls).toBe(1);
  now++;
  cache.ensureFresh('anthropic');
  await settle();
  expect(calls).toBe(2);
});

test('provider aliases and soonest-reset window selection', () => {
  for (const alias of ['openai-codex', 'codex', 'openai', 'chatgpt']) expect(resolveSupportedProvider(alias)).toBe('openai-codex');
  expect(resolveSupportedProvider('anthropic')).toBe('anthropic');
  expect(resolveSupportedProvider('opencode-go')).toBe('opencode-go');
  expect(resolveSupportedProvider('opencode')).toBeUndefined();
  expect(resolveSupportedProvider('other')).toBeUndefined();
  expect(resolveSupportedProvider()).toBeUndefined();
  const windows = [{ label: 'Week', usedPercent: 20, resetAt: new Date(1000) }, { label: '5h', usedPercent: 10, resetAt: new Date(500) }];
  expect(pickSubscriptionUsageWindow(windows)).toBe(windows[1]);
  expect(pickSubscriptionUsageWindow([{ label: 'first', usedPercent: 0 }])?.label).toBe('first');
  expect(pickSubscriptionUsageWindow([])).toBeUndefined();
});

test('cache routes GO fetches to the GO strategy', async () => {
  const cache = new SubscriptionUsageCache({ api: { fetchUsage: async strategy => {
    expect(strategy.provider).toBe('opencode-go');
    expect(strategy.label).toBe('OC-GO');
    expect(strategy.request({ token: 'key' }).url).toBe('https://opencode.ai/console/api/go/status');
    return { status: 'ok', label: strategy.label, windows: strategy.parse({ access: { meters: {
      fiveHour: { limitMicroCents: '100', usedMicroCents: '10', resetsAt: '2026-10-12T05:00:00Z' },
    } } }) };
  } } });
  cache.refresh('opencode-go');
  await settle();
  expect(cache.get('opencode-go')?.result?.status).toBe('ok');
  expect(cache.get('opencode-go')?.lastSuccess?.windows[0]?.usedPercent).toBe(10);
});
