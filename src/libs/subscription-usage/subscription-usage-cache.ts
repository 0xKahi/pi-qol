import { formatResetDescription } from './pace';
import { AnthropicOauthUsageStrategy } from './strategy/anthropic-oauth-usage.strategy';
import { OpenAiCodexUsageStrategy } from './strategy/openai-codex-usage.strategy';
import {
  type RateWindow,
  SUBSCRIPTION_USAGE_TTL_MS,
  type SubscriptionProvider,
  SubscriptionUsageApi,
  type SubscriptionUsageApiLike,
  type UsageResult,
} from './subscription-usage-api.util';

export type UsageCacheEntry = { result?: UsageResult; lastSuccess?: { windows: RateWindow[]; fetchedAt: number }; inFlight: boolean };

export function resolveSupportedProvider(provider?: string): SubscriptionProvider | undefined {
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
  let earliest: RateWindow | undefined;
  for (const window of windows) {
    if (!window.resetAt || !Number.isFinite(window.resetAt.getTime())) continue;
    if (!earliest?.resetAt || window.resetAt.getTime() <= earliest.resetAt.getTime()) earliest = window;
  }
  return earliest ?? windows[0];
}

export class SubscriptionUsageCache {
  private readonly entries = new Map<SubscriptionProvider, UsageCacheEntry>();
  private readonly lastAttemptAt = new Map<SubscriptionProvider, number>();
  private readonly listeners = new Set<() => void>();
  private readonly api: SubscriptionUsageApiLike;
  private readonly ttlMs: number;
  private readonly now: () => number;

  constructor(opts: { api?: SubscriptionUsageApiLike; ttlMs?: number; now?: () => number } = {}) {
    this.api = opts.api ?? new SubscriptionUsageApi(async () => undefined);
    this.ttlMs = opts.ttlMs ?? SUBSCRIPTION_USAGE_TTL_MS;
    this.now = opts.now ?? Date.now;
  }

  get(provider: SubscriptionProvider): UsageCacheEntry | undefined {
    return this.entries.get(provider);
  }

  ensureFresh(provider: SubscriptionProvider): UsageCacheEntry | undefined {
    const last = this.lastAttemptAt.get(provider);
    if (last === undefined || this.now() - last > this.ttlMs) this.refresh(provider);
    return this.get(provider);
  }

  refresh(provider: SubscriptionProvider): void {
    if (this.get(provider)?.inFlight) return;
    const entry: UsageCacheEntry = { ...this.get(provider), inFlight: true };
    this.entries.set(provider, entry);
    this.lastAttemptAt.set(provider, this.now());
    const strategy = provider === 'anthropic' ? new AnthropicOauthUsageStrategy() : new OpenAiCodexUsageStrategy();
    void Promise.resolve()
      .then(() => this.api.fetchUsage(strategy))
      .catch((): UsageResult => ({ status: 'network', label: strategy.label }))
      .then(result => {
        entry.result = result;
        if (result.status === 'ok') entry.lastSuccess = { windows: result.windows, fetchedAt: this.now() };
        entry.inFlight = false;
        for (const listener of this.listeners) listener();
      });
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  formatResetDescription(date: Date): string {
    return formatResetDescription(date, this.now());
  }
}
