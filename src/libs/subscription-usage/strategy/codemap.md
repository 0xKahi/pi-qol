# subscription-usage strategies

Pure `SubscriptionUsageStrategy` implementations expose `provider`, `label`, `request(auth): Request`, and `parse(json: unknown): RateWindow[]`. Network I/O, timeout and status classification belong to SubscriptionUsageApi, not strategies. Unknown shapes return an empty array.

- `anthropic-oauth-usage.strategy.ts`: bearer-authenticated Anthropic OAuth usage request with beta header. Parses five_hour (5h, 18000 seconds) and seven_day (Week, 604800 seconds), utilization and optional valid reset dates.
- `openai-codex-usage.strategy.ts`: bearer-authenticated wham usage request with optional ChatGPT-Account-Id. Keeps primary, secondary and named additional limits. Uses reported limit_window_seconds, falling back to 10800 / 86400 seconds; normalizes used percentage and reset epoch seconds.

Both use RawDataParser for defensive parsing and the shared auth/window contracts. Their requests have no timeout side effects; the API adds its abort signal.
