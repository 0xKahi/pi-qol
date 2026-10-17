import { RawDataParser } from '../../../utils/raw-data-parser.util';
import type { ProviderAuth, RateWindow, SubscriptionUsageStrategy } from '../subscription-usage-api.util';

export class OpenCodeGoUsageStrategy implements SubscriptionUsageStrategy {
  readonly provider = 'opencode-go';
  readonly label = 'OC-GO';

  parse(json: unknown): RateWindow[] {
    const access = RawDataParser.asRecord(RawDataParser.asRecord(json)?.access);
    const meters = RawDataParser.asRecord(access?.meters);
    if (!meters) return [];

    const windows: RateWindow[] = [];
    for (const [key, label, fallbackSeconds] of [
      ['fiveHour', '5h', 18000],
      ['week', 'Week', 604800],
      ['month', 'Month', undefined],
    ] as const) {
      const meter = RawDataParser.asRecord(meters[key]);
      const limit = RawDataParser.numberValue(meter?.limitMicroCents);
      const rawUsed = meter?.usedMicroCents;
      if (typeof rawUsed !== 'number' && !RawDataParser.stringValue(rawUsed)) continue;
      const used = RawDataParser.numberValue(rawUsed);
      const reset = RawDataParser.stringValue(meter?.resetsAt);
      const resetAt = reset ? new Date(reset) : undefined;
      if (limit === undefined || limit <= 0 || used === undefined || !resetAt || !Number.isFinite(resetAt.getTime())) continue;
      const start = RawDataParser.stringValue(key === 'month' ? access?.startsAt : meter?.startsAt);
      const duration = start ? (resetAt.getTime() - new Date(start).getTime()) / 1000 : NaN;
      windows.push({
        label,
        usedPercent: (used / limit) * 100,
        resetAt,
        windowSeconds: Number.isFinite(duration) && duration > 0 ? duration : fallbackSeconds,
      });
    }
    return windows;
  }

  request(auth: ProviderAuth): Request {
    return new Request('https://opencode.ai/console/api/go/status', {
      method: 'GET',
      headers: { Authorization: `Bearer ${auth.token}` },
    });
  }
}
