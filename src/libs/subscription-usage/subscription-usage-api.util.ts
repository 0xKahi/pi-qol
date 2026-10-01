import { AnthropicOauthUsageStrategy } from './strategy/anthropic-oauth-usage.strategy';
import { OpenAiCodexUsageStrategy } from './strategy/openai-codex-usage.strategy';

export const SUBSCRIPTION_USAGE_FETCH_TIMEOUT_MS = 10_000;
export const SUBSCRIPTION_USAGE_TTL_MS = 60_000;

export type SubscriptionProvider = 'anthropic' | 'openai-codex';
export const SUBSCRIPTION_PROVIDERS: readonly { provider: SubscriptionProvider; label: string }[] = [
  { provider: 'anthropic', label: new AnthropicOauthUsageStrategy().label },
  { provider: 'openai-codex', label: new OpenAiCodexUsageStrategy().label },
];
export type ProviderAuth = { token: string; accountId?: string };
export type CredentialResolver = (provider: SubscriptionProvider) => Promise<ProviderAuth | undefined>;
export type RateWindow = { label: string; usedPercent: number; resetAt?: Date; windowSeconds?: number };
export type UsageResult =
  | { status: 'ok'; label: string; windows: RateWindow[] }
  | { status: 'no-auth' | 'expired' | 'network' | 'unavailable'; label: string }
  | { status: 'http-error'; label: string; httpStatus: number };

export interface SubscriptionUsageStrategy {
  readonly provider: SubscriptionProvider;
  readonly label: string;
  request(auth: ProviderAuth): Request;
  parse(json: unknown): RateWindow[];
}

export type SubscriptionUsageApiLike = Pick<SubscriptionUsageApi, 'fetchUsage'>;

export class SubscriptionUsageApi {
  constructor(
    private readonly resolveCredentials: CredentialResolver,
    private readonly fetchFn: (request: Request) => Promise<Response> = fetch,
  ) {}

  async fetchUsage(strategy: SubscriptionUsageStrategy): Promise<UsageResult> {
    const label = strategy.label;
    try {
      const auth = await this.resolveCredentials(strategy.provider);
      if (!auth) return { status: 'no-auth', label };
      const request = new Request(strategy.request(auth), { signal: AbortSignal.timeout(SUBSCRIPTION_USAGE_FETCH_TIMEOUT_MS) });
      const response = await this.fetchFn(request);
      if (response.status === 401 || response.status === 403) return { status: 'expired', label };
      if (!response.ok) return { status: 'http-error', label, httpStatus: response.status };
      let json: unknown;
      try {
        json = await response.json();
      } catch (error) {
        if (request.signal.aborted || (error instanceof DOMException && error.name === 'AbortError')) throw error;
        return { status: 'unavailable', label };
      }
      const windows = strategy.parse(json);
      return windows.length ? { status: 'ok', label, windows } : { status: 'unavailable', label };
    } catch {
      return { status: 'network', label };
    }
  }
}
