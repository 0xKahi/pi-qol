import { describe, expect, test } from 'bun:test';
import type { FetchUsageResponse, SubscriptionUsageStrategy } from '../../src/libs/subscription-usage/subscription-usage-api.util';
import {
  SubscriptionUsageManager,
  pickSubscriptionUsageWindow,
  resolveSupportedProvider,
  type SubscriptionUsageApiLike,
} from '../../src/extensions/custom-footer/subscription-usage-manager';

const response: FetchUsageResponse = {
  label: 'Claude',
  rateWindow: [{ label: '5h', usedPercent: 50, resetAt: new Date(Date.now() + 60_000) }],
};

function tick(): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, 0));
}

describe('custom-footer subscription usage manager', () => {
  test('resolveSupportedProvider maps known pi provider ids', () => {
    expect(resolveSupportedProvider('anthropic')).toBe('anthropic');
    expect(resolveSupportedProvider('openai-codex')).toBe('openai-codex');
    expect(resolveSupportedProvider('codex')).toBe('openai-codex');
    expect(resolveSupportedProvider('openai')).toBe('openai-codex');
    expect(resolveSupportedProvider('google')).toBeUndefined();
    expect(resolveSupportedProvider(undefined)).toBeUndefined();
  });

  test('pickSubscriptionUsageWindow chooses earliest reset and falls back to first window', () => {
    const late = { label: 'late', usedPercent: 10, resetAt: new Date('2026-01-02T00:00:00.000Z') };
    const early = { label: 'early', usedPercent: 20, resetAt: new Date('2026-01-01T00:00:00.000Z') };
    const noReset = { label: 'none', usedPercent: 30 };

    expect(pickSubscriptionUsageWindow([late, noReset, early])).toBe(early);
    expect(pickSubscriptionUsageWindow([noReset, late])).toBe(late);
    expect(pickSubscriptionUsageWindow([noReset, { label: 'second', usedPercent: 40 }])).toBe(noReset);
    expect(pickSubscriptionUsageWindow([])).toBeUndefined();
  });

  test('ensureFresh fetches lazily, caches responses, and suppresses duplicate in-flight fetches', async () => {
    let calls = 0;
    let resolveFetch: (value: FetchUsageResponse) => void = () => undefined;
    const api: SubscriptionUsageApiLike = {
      fetchUsage: async (strategy: SubscriptionUsageStrategy) => {
        calls++;
        expect(strategy.provider).toBe('anthropic');
        return new Promise<FetchUsageResponse>(resolve => {
          resolveFetch = resolve;
        });
      },
      formatResetDescription: () => '1h',
    };
    let updates = 0;
    const manager = new SubscriptionUsageManager(api, () => updates++, 60_000);

    expect(manager.ensureFresh('anthropic')).toBeUndefined();
    expect(manager.ensureFresh('anthropic')).toBeUndefined();
    expect(calls).toBe(1);

    resolveFetch(response);
    await tick();

    expect(manager.get('anthropic')).toBe(response);
    expect(manager.ensureFresh('anthropic')).toBe(response);
    expect(calls).toBe(1);
    expect(updates).toBe(1);
  });

  test('ensureFresh refreshes stale cache entries', async () => {
    let calls = 0;
    const api: SubscriptionUsageApiLike = {
      fetchUsage: async () => {
        calls++;
        return response;
      },
      formatResetDescription: () => '1h',
    };
    const manager = new SubscriptionUsageManager(api, undefined, -1);

    manager.ensureFresh('anthropic');
    await tick();
    expect(manager.get('anthropic')).toBe(response);

    manager.ensureFresh('anthropic');
    await tick();
    expect(calls).toBe(2);
  });

  test('fetch failures and empty responses are best effort', async () => {
    const emptyApi: SubscriptionUsageApiLike = {
      fetchUsage: async () => undefined,
      formatResetDescription: () => '1h',
    };
    const emptyManager = new SubscriptionUsageManager(emptyApi, () => {
      throw new Error('should not update');
    });
    emptyManager.ensureFresh('anthropic');
    await tick();
    expect(emptyManager.get('anthropic')).toBeUndefined();

    const throwingApi: SubscriptionUsageApiLike = {
      fetchUsage: async () => {
        throw new Error('network');
      },
      formatResetDescription: () => '1h',
    };
    const throwingManager = new SubscriptionUsageManager(throwingApi);
    throwingManager.ensureFresh('anthropic');
    await tick();
    expect(throwingManager.get('anthropic')).toBeUndefined();
  });

  test('formatResetDescription delegates to injected api', () => {
    const api: SubscriptionUsageApiLike = {
      fetchUsage: async () => response,
      formatResetDescription: date => `reset:${date.toISOString()}`,
    };
    const manager = new SubscriptionUsageManager(api);
    const date = new Date('2026-01-01T00:00:00.000Z');

    expect(manager.formatResetDescription(date)).toBe('reset:2026-01-01T00:00:00.000Z');
  });
});
