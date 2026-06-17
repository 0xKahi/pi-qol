import { AnthropicOauthUsageStrategy } from '../../libs/subscription-usage/strategy/anthropic-oauth-usage.strategy';
import { OpenAiCodexUsageStrategy } from '../../libs/subscription-usage/strategy/openai-codex-usage.strategy';
import {
  type FetchUsageResponse,
  type RateWindow,
  SubscriptionUsageApi,
  type SubscriptionUsageStrategy,
} from '../../libs/subscription-usage/subscription-usage-api.util';
import { SUBSCRIPTION_USAGE_TTL_MS } from './constants';
import type { SupportedProvider } from './types';

export type SubscriptionUsageApiLike = Pick<SubscriptionUsageApi, 'fetchUsage' | 'formatResetDescription'>;

export function resolveSupportedProvider(provider: string | undefined): SupportedProvider | undefined {
  switch (provider?.toLowerCase()) {
    case 'anthropic':
      return 'anthropic';
    case 'openai-codex':
    case 'codex':
    case 'openai':
    case 'chatgpt':
      return 'openai-codex';
    default:
      return undefined;
  }
}

export function pickSubscriptionUsageWindow(windows: readonly RateWindow[]): RateWindow | undefined {
  let earliestWithReset: RateWindow | undefined;

  for (const window of windows) {
    if (!window.resetAt) continue;
    if (!earliestWithReset?.resetAt || window.resetAt.getTime() <= earliestWithReset.resetAt.getTime()) {
      earliestWithReset = window;
    }
  }

  return earliestWithReset ?? windows[0];
}

export class SubscriptionUsageManager {
  private cache = new Map<SupportedProvider, FetchUsageResponse>();
  private inFlight = new Set<SupportedProvider>();
  private lastFetchAt = new Map<SupportedProvider, number>();

  constructor(
    private api: SubscriptionUsageApiLike = new SubscriptionUsageApi(),
    private onUpdate?: () => void,
    private ttlMs = SUBSCRIPTION_USAGE_TTL_MS,
  ) {}

  get(provider: SupportedProvider): FetchUsageResponse | undefined {
    return this.cache.get(provider);
  }

  ensureFresh(provider: SupportedProvider): FetchUsageResponse | undefined {
    const last = this.lastFetchAt.get(provider) ?? 0;
    if (!this.inFlight.has(provider) && Date.now() - last > this.ttlMs) {
      this.refresh(provider);
    }

    return this.cache.get(provider);
  }

  formatResetDescription(date: Date): string {
    return this.api.formatResetDescription(date);
  }

  private refresh(provider: SupportedProvider): void {
    this.inFlight.add(provider);
    this.lastFetchAt.set(provider, Date.now());

    void this.api
      .fetchUsage(this.strategyFor(provider))
      .then(response => {
        if (!response) return;
        this.cache.set(provider, response);
        this.onUpdate?.();
      })
      .catch(() => {
        // Best-effort status: auth/network failures simply hide the segment.
      })
      .finally(() => {
        this.inFlight.delete(provider);
      });
  }

  private strategyFor(provider: SupportedProvider): SubscriptionUsageStrategy {
    return provider === 'anthropic' ? new AnthropicOauthUsageStrategy() : new OpenAiCodexUsageStrategy();
  }
}
