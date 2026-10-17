import { afterEach, expect, spyOn, test } from 'bun:test';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { ExtensionContext } from '@earendil-works/pi-coding-agent';
import { createHostCredentialResolver, type SubscriptionProvider } from '../../src/libs/subscription-usage';
import { PathUtil } from '../../src/utils/path.util';

const dir = mkdtempSync(join(tmpdir(), 'usage-auth-'));
const path = join(dir, 'auth.json');
const pathSpy = spyOn(PathUtil, 'findPiAuthConfig').mockReturnValue({ path, exists: true });
afterEach(() => { writeFileSync(path, '{}'); });

function resolver(entry: unknown, host: () => Promise<unknown>, provider: SubscriptionProvider = 'openai-codex') {
  writeFileSync(path, JSON.stringify({ [provider]: entry }));
  const ctx = { modelRegistry: { getProviderAuth: host } } as unknown as ExtensionContext;
  return createHostCredentialResolver(() => ctx);
}

test('host refreshed token is preferred and stored account id sent', async () => {
  const resolve = resolver({ type: 'oauth', access: 'old', accountId: 'account' }, async () => ({ auth: { apiKey: 'new' } }));
  expect(await resolve('openai-codex')).toEqual({ token: 'new', accountId: 'account' });
});

test('missing and non-oauth entries reject ambient auth', async () => {
  for (const entry of [undefined, { type: 'api_key', access: 'key' }]) {
    let calls = 0;
    const resolve = resolver(entry, async () => { calls++; return { auth: { apiKey: 'ambient' } }; });
    expect(await resolve('openai-codex')).toBeUndefined();
    expect(calls).toBe(0);
  }
});

test('stored token fallback on empty host auth or refresh error, JWT account fallback', async () => {
  const payload = Buffer.from(JSON.stringify({ 'https://api.openai.com/auth': { chatgpt_account_id: 'jwt-account' } })).toString('base64url');
  const access = `header.${payload}.signature`;
  for (const host of [async () => ({ auth: { apiKey: '' } }), async () => { throw new Error('refresh'); }]) {
    expect(await resolver({ access }, host)('openai-codex')).toEqual({ token: access, accountId: 'jwt-account' });
  }
  expect(await resolver({ access: 'invalid' }, async () => undefined)('openai-codex')).toEqual({ token: 'invalid', accountId: undefined });
});

test('malformed auth is no-auth', async () => {
  writeFileSync(path, 'not json');
  expect(await createHostCredentialResolver(() => undefined)('anthropic')).toBeUndefined();
});

import { afterAll } from 'bun:test';
afterAll(() => { pathSpy.mockRestore(); rmSync(dir, { recursive: true, force: true }); });

test('provider auth types reject Anthropic keys and GO OAuth, including legacy OAuth', async () => {
  for (const [provider, entry] of [
    ['anthropic', { type: 'api_key', key: 'key' }],
    ['opencode-go', { type: 'oauth', access: 'token' }],
    ['opencode-go', { access: 'legacy-token' }],
  ] as const) {
    let calls = 0;
    const resolve = resolver(entry, async () => { calls++; return { auth: { apiKey: 'host' } }; }, provider);
    expect(await resolve(provider)).toBeUndefined();
    expect(calls).toBe(0);
  }
});

test('GO prefers host keys and falls back to stored keys on empty auth or errors', async () => {
  const entry = { type: 'api_key', key: 'stored-key', access: 'wrong-secret' };
  expect(await resolver(entry, async () => ({ auth: { apiKey: 'host-key' } }), 'opencode-go')('opencode-go'))
    .toEqual({ token: 'host-key', accountId: undefined });
  for (const host of [async () => undefined, async () => { throw new Error('host failure'); }]) {
    expect(await resolver(entry, host, 'opencode-go')('opencode-go')).toEqual({ token: 'stored-key', accountId: undefined });
  }
});

test('GO requires its auth.json entry even when host has an environment key', async () => {
  let calls = 0;
  const resolve = resolver(undefined, async () => { calls++; return { auth: { apiKey: 'env-key' } }; }, 'opencode-go');
  expect(await resolve('opencode-go')).toBeUndefined();
  expect(calls).toBe(0);
});

test('Anthropic legacy OAuth entries retain stored access fallback', async () => {
  expect(await resolver({ access: 'legacy' }, async () => undefined, 'anthropic')('anthropic'))
    .toEqual({ token: 'legacy', accountId: undefined });
});
