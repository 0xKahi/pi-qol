import type { SubscriptionProvider } from './subscription-usage-api.util';

export const PROVIDER_USAGE_COLORS: Readonly<Record<SubscriptionProvider, string>> = {
  anthropic: '#D97706',
  'openai-codex': '#10B981',
};

export function providerUsageColor(provider: SubscriptionProvider): string {
  return PROVIDER_USAGE_COLORS[provider];
}
