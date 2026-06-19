# src/libs/subscription-usage/

## Responsibility

Encapsulates fetching and normalizing subscription usage (rate-limit utilization) from external AI providers into a common `RateWindow` representation. It is the single place the system queries provider-specific usage APIs and turns their heterogeneous responses into a consistent, UI-friendly shape.

## Design Patterns

- **Strategy**: `SubscriptionUsageApi` consumes a `SubscriptionUsageStrategy` (`AnthropicOauthUsageStrategy`, `OpenAiCodexUsageStrategy`) without knowing provider-specific details.
- **Adapter / Normalization**: each strategy adapts a provider response to the shared `RateWindow[]` model (`label`, `usedPercent`, `resetAt`).
- **Safe parsing**: `RawDataParser` guards against unexpected JSON shapes and missing fields.
- **Utility API class**: `SubscriptionUsageApi` wraps auth loading, fetching, and formatting in one injectable-style class.

## Data & Control Flow

1. A caller invokes `SubscriptionUsageApi.fetchUsage(strategy)`.
2. The API loads provider OAuth credentials from the local auth config via `PathUtil.findPiAuthConfig()`.
3. It calls `strategy.fetchUsage(auth)`.
4. The strategy performs a provider HTTP request, parses JSON, and maps relevant fields to `RateWindow[]`.
5. The API wraps the result in `FetchUsageResponse` (`label`, `rateWindow`).
6. `formatResetDescription(resetAt)` converts reset timestamps to human-readable relative strings (`5m`, `2h30m`, `1d`, etc.).

## Integration Points

- **Local auth config**: `PathUtil.findPiAuthConfig()` supplies `SubscriptionAuthconfig`, which maps providers to `{ access, accountId }` objects.
- **Anthropic API**: `AnthropicOauthUsageStrategy` calls `https://api.anthropic.com/api/oauth/usage` with `Authorization: Bearer <token>` and `anthropic-beta: oauth-2025-04-20`.
- **OpenAI Codex API**: `OpenAiCodexUsageStrategy` calls `https://chatgpt.com/backend-api/wham/usage` with bearer token and optional `ChatGPT-Account-Id` header.
- **Shared utilities**: depends on `src/utils/path.util` for config discovery and `src/utils/raw-data-parser.util` for defensive JSON parsing.
