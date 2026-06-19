# src/libs/

## Responsibility

`src/libs/` hosts shared, domain-specific library modules that are consumed by extensions and features across the project. It is not a generic utilities folder; modules here encapsulate cohesive business capabilities with stable public APIs.

Currently, the folder contains the `subscription-usage` module, whose job is to fetch and normalize subscription/rate-limit usage data from upstream OAuth providers (Anthropic, OpenAI Codex) so that UI code can display a consistent usage indicator without needing to know provider-specific API details.

## Design Patterns

- **Strategy pattern** — A provider-agnostic `SubscriptionUsageStrategy` interface is implemented by per-provider strategies (`AnthropicOauthUsageStrategy`, `OpenAiCodexUsageStrategy`). This keeps provider-specific request building, response parsing, and window mapping isolated and makes adding new providers a matter of adding another strategy.
- **API facade** — `SubscriptionUsageApi` presents a single `fetchUsage(strategy)` entry point. It handles credential lookup and delegates the provider-specific call to the supplied strategy, returning a normalized `FetchUsageResponse`.
- **Adapter/normalization** — Each strategy adapts a different upstream API shape into the common `RateWindow[]` model (`label`, `usedPercent`, `resetAt`), so consumers operate on one uniform data structure.
- **Defensive parsing** — Strategies use `RawDataParser` to coerce unknown provider JSON into typed records/values, avoiding runtime exceptions from unexpected payload shapes.
- **Config-driven auth** — `SubscriptionUsageApi` reads provider tokens (and optional account IDs) from a local pi auth config file rather than accepting credentials directly.

## Data & Control Flow

1. A consumer (e.g., `SubscriptionUsageManager`) selects a provider and asks `SubscriptionUsageApi.fetchUsage()` to load usage data for that provider's strategy.
2. `SubscriptionUsageApi` loads the auth config via `PathUtil.findPiAuthConfig()`, extracts the token/account for the strategy's provider, and bails out gracefully if no auth is available.
3. The strategy builds its provider-specific HTTP request, calls the upstream endpoint, and parses the response.
4. The strategy maps the provider payload into `RateWindow[]` and returns it.
5. `SubscriptionUsageApi` wraps the windows with the strategy's human-readable `label` into a `FetchUsageResponse`.
6. Consumers can use `SubscriptionUsageApi.formatResetDescription(date)` to turn a `resetAt` timestamp into a short relative string such as `15m`, `2h30m`, or `1d`.

## Integration Points

- **Consumers** — `src/extensions/custom-footer/subscription-usage-manager.ts` imports the strategies and `SubscriptionUsageApi`, caches responses, picks the most relevant window, and drives UI updates.
- **Auth/config** — `src/utils/path.util.ts` (`PathUtil.findPiAuthConfig()`) locates the local auth file; the API expects provider entries keyed by `SubscriptionProvider` names.
- **Parsing utility** — `src/utils/raw-data-parser.util.ts` is used across strategies to safely read fields from dynamic JSON.
- **External services** — Strategies call live provider endpoints:
  - Anthropic: `https://api.anthropic.com/api/oauth/usage`
  - OpenAI Codex: `https://chatgpt.com/backend-api/wham/usage`
