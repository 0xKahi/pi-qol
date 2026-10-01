import { afterEach, expect, spyOn, test } from 'bun:test';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { ExtensionContext } from '@earendil-works/pi-coding-agent';
import { createHostCredentialResolver } from '../../src/libs/subscription-usage';
import { PathUtil } from '../../src/utils/path.util';

const dir = mkdtempSync(join(tmpdir(), 'usage-auth-'));
const path = join(dir, 'auth.json');
const pathSpy = spyOn(PathUtil, 'findPiAuthConfig').mockReturnValue({ path, exists: true });
afterEach(() => { writeFileSync(path, '{}'); });

function resolver(entry: unknown, host: () => Promise<unknown>) {
  writeFileSync(path, JSON.stringify({ 'openai-codex': entry }));
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
