import { RawDataParser } from '../../../utils/raw-data-parser.util';
import type { ProviderAuth, RateWindow, SubscriptionUsageStrategy } from '../subscription-usage-api.util';

const PRIMARY_WINDOW_FALLBACK_SECONDS = 10800;
const SECONDARY_WINDOW_FALLBACK_SECONDS = 86400;

export class OpenAiCodexUsageStrategy implements SubscriptionUsageStrategy {
  readonly provider = 'openai-codex';
  readonly label = 'Codex';

  async fetchUsage(auth: ProviderAuth) {
    const response = await fetch(this.request(auth));
    if (!response.ok) return;

    const data = RawDataParser.asRecord(await response.json());
    if (!data) return;

    const windows: RateWindow[] = [];
    this.pushRateLimitWindows(windows, RawDataParser.asRecord(data.rate_limit));

    const additionalRateLimits = Array.isArray(data.additional_rate_limits) ? data.additional_rate_limits : [];
    for (const item of additionalRateLimits) {
      const entry = RawDataParser.asRecord(item);
      if (!entry) continue;

      const prefix = RawDataParser.stringValue(entry.limit_name) ?? RawDataParser.stringValue(entry.metered_feature) ?? 'Additional';
      this.pushRateLimitWindows(windows, RawDataParser.asRecord(entry.rate_limit), prefix);
    }

    return windows.length > 0 ? windows : undefined;
  }

  private pushRateLimitWindows(windows: RateWindow[], rateLimit: Record<string, unknown> | undefined, prefix?: string): void {
    this.pushRateWindow(windows, RawDataParser.asRecord(rateLimit?.primary_window), PRIMARY_WINDOW_FALLBACK_SECONDS, prefix);
    this.pushRateWindow(windows, RawDataParser.asRecord(rateLimit?.secondary_window), SECONDARY_WINDOW_FALLBACK_SECONDS, prefix);
  }

  private pushRateWindow(windows: RateWindow[], window: Record<string, unknown> | undefined, fallbackWindowSeconds: number, prefix?: string): void {
    if (!window) return;

    const resetDate = this.getResetDate(window);
    windows.push({
      label: this.getWindowLabel(RawDataParser.numberValue(window.limit_window_seconds), fallbackWindowSeconds, prefix),
      usedPercent: RawDataParser.numberValue(window.used_percent) ?? 0,
      resetAt: resetDate,
    });
  }

  private getResetDate(window: Record<string, unknown>): Date | undefined {
    const resetSeconds = RawDataParser.numberValue(window.reset_at);
    if (!resetSeconds) return;

    const resetDate = new Date(resetSeconds * 1000);
    return Number.isFinite(resetDate.getTime()) ? resetDate : undefined;
  }

  private getWindowLabel(windowSeconds: number | undefined, fallbackWindowSeconds: number, prefix?: string): string {
    const seconds = windowSeconds && windowSeconds > 0 ? windowSeconds : fallbackWindowSeconds;
    const hours = Math.round(seconds / 3600);

    const label = hours >= 144 ? 'Week' : hours >= 24 ? 'Day' : `${hours}h`;
    return prefix ? `${prefix} ${label}` : label;
  }

  private request(opts: ProviderAuth) {
    return new Request('https://chatgpt.com/backend-api/wham/usage', {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${opts.token}`,
        ...(opts?.accountId ? { 'ChatGPT-Account-Id': opts.accountId } : {}),
        Accept: 'application/json',
      },
    });
  }
}
