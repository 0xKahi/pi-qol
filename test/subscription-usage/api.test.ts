import { expect, spyOn, test } from 'bun:test';
import { AnthropicOauthUsageStrategy, SubscriptionUsageApi } from '../../src/libs/subscription-usage';

const strategy = new AnthropicOauthUsageStrategy();
test('no credentials makes no request', async () => {
  let requests = 0;
  const api = new SubscriptionUsageApi(async () => undefined, async () => { requests++; return new Response(); });
  expect(await api.fetchUsage(strategy)).toEqual({ status: 'no-auth', label: 'Claude' });
  expect(requests).toBe(0);
});

for (const status of [401, 403, 500]) {
  test(`classifies HTTP ${status}`, async () => {
    const api = new SubscriptionUsageApi(async () => ({ token: 'token' }), async () => new Response('', { status }));
    expect(await api.fetchUsage(strategy)).toEqual(status === 500 ? { status: 'http-error', label: 'Claude', httpStatus: 500 } : { status: 'expired', label: 'Claude' });
  });
}

test('thrown requests and timeout aborts produce network', async () => {
  for (const error of [new Error('offline'), new DOMException('timeout', 'TimeoutError')]) {
    const api = new SubscriptionUsageApi(async () => ({ token: 'token' }), async request => {
      expect(request.signal.aborted).toBe(false);
      throw error;
    });
    expect(await api.fetchUsage(strategy)).toEqual({ status: 'network', label: 'Claude' });
  }
});

test('fetch timeout aborts a pending request', async () => {
  const shortTimeout = AbortSignal.timeout(5);
  const timeout = spyOn(AbortSignal, 'timeout').mockReturnValue(shortTimeout);
  try {
    const api = new SubscriptionUsageApi(async () => ({ token: 'token' }), request => new Promise((_resolve, reject) => {
      request.signal.addEventListener('abort', () => reject(request.signal.reason), { once: true });
    }));
    expect(await api.fetchUsage(strategy)).toEqual({ status: 'network', label: 'Claude' });
    expect(timeout).toHaveBeenCalledWith(10000);
  } finally {
    timeout.mockRestore();
  }
});

test('malformed JSON is unavailable, but body-read aborts remain network', async () => {
  const malformed = new SubscriptionUsageApi(async () => ({ token: 'token' }), async () => new Response('not JSON'));
  expect(await malformed.fetchUsage(strategy)).toEqual({ status: 'unavailable', label: 'Claude' });
  const aborted = new SubscriptionUsageApi(async () => ({ token: 'token' }), async () => {
    const response = new Response();
    spyOn(response, 'json').mockRejectedValue(new DOMException('aborted', 'AbortError'));
    return response;
  });
  expect(await aborted.fetchUsage(strategy)).toEqual({ status: 'network', label: 'Claude' });
});

test('empty response is unavailable and valid response is ok with host auth', async () => {
  const api = new SubscriptionUsageApi(async () => ({ token: 'refreshed' }), async request => {
    expect(request.headers.get('Authorization')).toBe('Bearer refreshed');
    return Response.json({ five_hour: { utilization: 30 } });
  });
  expect((await api.fetchUsage(strategy)).status).toBe('ok');
  const empty = new SubscriptionUsageApi(async () => ({ token: 'token' }), async () => Response.json({}));
  expect(await empty.fetchUsage(strategy)).toEqual({ status: 'unavailable', label: 'Claude' });
});
