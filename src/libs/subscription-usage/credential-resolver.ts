import { readFileSync } from 'node:fs';
import type { ExtensionContext } from '@earendil-works/pi-coding-agent';
import { PathUtil } from '../../utils/path.util';
import { RawDataParser } from '../../utils/raw-data-parser.util';
import type { CredentialResolver } from './subscription-usage-api.util';

function jwtAccountId(token: string): string | undefined {
  try {
    const payload = token.split('.')[1];
    if (!payload) return undefined;
    const claims = RawDataParser.asRecord(JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')));
    const auth = RawDataParser.asRecord(claims?.['https://api.openai.com/auth']);
    return RawDataParser.stringValue(auth?.chatgpt_account_id);
  } catch {
    return undefined;
  }
}

export function createHostCredentialResolver(getCtx: () => ExtensionContext | undefined): CredentialResolver {
  return async provider => {
    try {
      const path = PathUtil.findPiAuthConfig();
      if (!path.exists) return undefined;
      const config = RawDataParser.asRecord(JSON.parse(readFileSync(path.path, 'utf8')));
      const stored = RawDataParser.asRecord(config?.[provider]);
      if (!stored || (stored.type !== undefined && stored.type !== 'oauth')) return undefined;
      let token: string | undefined;
      try {
        const resolved = await getCtx()?.modelRegistry.getProviderAuth(provider);
        token = RawDataParser.stringValue(resolved?.auth?.apiKey);
      } catch {
        // Stored access is the verified fallback when host refresh fails.
      }
      token ||= RawDataParser.stringValue(stored.access);
      if (!token) return undefined;
      return {
        token,
        accountId: provider === 'openai-codex' ? RawDataParser.stringValue(stored.accountId) || jwtAccountId(token) : undefined,
      };
    } catch {
      return undefined;
    }
  };
}
