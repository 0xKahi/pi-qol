# subscription-usage strategy codemap

## Responsibility

This directory contains provider-specific implementations of `SubscriptionUsageStrategy`.
Each strategy is responsible for:

- Building the authenticated HTTP request for a single provider.
- Fetching usage data from that provider's API.
- Parsing the raw JSON response into a normalized `RateWindow[]`.
- Returning `undefined` when no usable usage data is available.

Current strategies:

- `AnthropicOauthUsageStrategy` — fetches Anthropic OAuth usage and exposes the `five_hour` and `seven_day` windows.
- `OpenAiCodexUsageStrategy` — fetches OpenAI Codex usage and exposes the main `rate_limit` windows plus any `additional_rate_limits`.

## Design Patterns

- **Strategy pattern** — both classes implement the common `SubscriptionUsageStrategy` interface, so the caller (`SubscriptionUsageApi`) can treat them uniformly.
- **Encapsulation of provider details** — request construction, response parsing, and window labeling are kept private to each strategy.
- **Defensive parsing** — unknown API responses are coerced safely through `RawDataParser` before being used.
- **Helper decomposition** — the OpenAI strategy splits parsing into small private helpers (`pushRateLimitWindows`, `pushRateWindow`, `getResetDate`, `getWindowLabel`) to keep the main flow readable.

## Data & Control Flow

1. `SubscriptionUsageApi.fetchUsage(strategy)` loads provider credentials and calls `strategy.fetchUsage(auth)`.
2. Each strategy builds a provider-specific `Request` and calls `fetch`.
3. The JSON response is converted to a `Record<string, unknown>` via `RawDataParser.asRecord`.
4. Relevant fields are extracted:
   - **Anthropic**: iterates over `five_hour` and `seven_day`, reads `utilization` as `usedPercent`, and parses `resets_at` into a `Date`.
   - **OpenAI**: reads `rate_limit.primary_window` and `rate_limit.secondary_window`, then loops over `additional_rate_limits`.
5. Each discovered window is pushed as a `RateWindow` object with `label`, `usedPercent`, and optional `resetAt`.
6. The array is returned to `SubscriptionUsageApi`, which wraps it in a `FetchUsageResponse` keyed by the strategy's `label`.

## Integration Points

- **Interface contract**: strategies implement `SubscriptionUsageStrategy` and use the `ProviderAuth`, `RateWindow`, and `SubscriptionProvider` types from `../subscription-usage-api.util`.
- **Shared utility**: all parsing helpers come from `../../../utils/raw-data-parser.util` (`RawDataParser`).
- **Network layer**: strategies use the global `fetch` API directly.
- **Provider endpoints**:
  - Anthropic: `https://api.anthropic.com/api/oauth/usage` — authenticated with a `Bearer` token and the `anthropic-beta: oauth-2025-04-20` header.
  - OpenAI Codex: `https://chatgpt.com/backend-api/wham/usage` — authenticated with a `Bearer` token and an optional `ChatGPT-Account-Id` header.
- **Consumer**: `SubscriptionUsageApi` orchestrates strategies, loads auth config via `PathUtil.findPiAuthConfig`, and formats results for downstream display.
