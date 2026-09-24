import { afterEach, describe, expect, test } from 'bun:test';
import { AnthropicOauthUsageStrategy } from '../../src/libs/subscription-usage/strategy/anthropic-oauth-usage.strategy';
import { OpenAiCodexUsageStrategy } from '../../src/libs/subscription-usage/strategy/openai-codex-usage.strategy';

const originalFetch = globalThis.fetch;

function mockFetch(response: { ok: boolean; json: () => Promise<unknown> }): Request[] {
  const requests: Request[] = [];
  globalThis.fetch = (async input => {
    requests.push(input as Request);
    return response as Response;
  }) as typeof fetch;
  return requests;
}

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe('subscription usage strategies', () => {
  test('Anthropic returns undefined for non-ok responses', async () => {
    mockFetch({ ok: false, json: async () => ({ five_hour: { utilization: 25 } }) });

    expect(await new AnthropicOauthUsageStrategy().fetchUsage({ token: 'token' })).toBeUndefined();
  });

  test('Anthropic parses usage windows from ok responses', async () => {
    mockFetch({
      ok: true,
      json: async () => ({
        five_hour: { utilization: 25, resets_at: '2026-01-01T00:00:00.000Z' },
        seven_day: { utilization: 50 },
      }),
    });

    expect(await new AnthropicOauthUsageStrategy().fetchUsage({ token: 'token' })).toEqual([
      { label: '5h', usedPercent: 25, resetAt: new Date('2026-01-01T00:00:00.000Z') },
      { label: 'Week', usedPercent: 50, resetAt: undefined },
    ]);
  });

  test('Anthropic returns undefined when no windows are recognized', async () => {
    mockFetch({ ok: true, json: async () => ({ unrelated: true }) });

    expect(await new AnthropicOauthUsageStrategy().fetchUsage({ token: 'token' })).toBeUndefined();
  });

  test('both strategies pass a non-aborted timeout signal in their request', async () => {
    const requests = mockFetch({ ok: true, json: async () => ({}) });

    await new AnthropicOauthUsageStrategy().fetchUsage({ token: 'token' });
    await new OpenAiCodexUsageStrategy().fetchUsage({ token: 'token' });

    expect(requests).toHaveLength(2);
    for (const request of requests) {
      expect(request.signal).toBeDefined();
      expect(request.signal?.aborted).toBe(false);
    }
  });
});
