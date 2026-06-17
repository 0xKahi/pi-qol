import { RawDataParser } from '../../../utils/raw-data-parser.util';
import type { ProviderAuth, RateWindow, SubscriptionUsageStrategy } from '../subscription-usage-api.util';

export class AnthropicOauthUsageStrategy implements SubscriptionUsageStrategy {
  readonly provider = 'anthropic';
  readonly label = 'Claude';

  async fetchUsage(auth: ProviderAuth) {
    const response = await fetch(this.request(auth));
    const data = RawDataParser.asRecord(await response.json());
    if (!data) return;

    const windows: RateWindow[] = [];
    for (const [key, label] of [
      ['five_hour', '5h'],
      ['seven_day', 'Week'],
    ] as const) {
      const source = RawDataParser.asRecord(data[key]);
      const usedPercent = RawDataParser.numberValue(source?.utilization);
      if (usedPercent === undefined) continue;
      const resetAt = RawDataParser.stringValue(source?.resets_at);
      const resetDate = resetAt ? new Date(resetAt) : undefined;
      windows.push({
        label,
        usedPercent,
        resetAt: resetDate && Number.isFinite(resetDate.getTime()) ? resetDate : undefined,
      });
    }
    return windows;
  }

  private request(opts: ProviderAuth) {
    return new Request('https://api.anthropic.com/api/oauth/usage', {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${opts.token}`,
        'anthropic-beta': 'oauth-2025-04-20',
      },
    });
  }
}
