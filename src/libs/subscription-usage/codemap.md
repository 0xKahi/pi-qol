# src/libs/subscription-usage/

## Responsibility

Shared subscription data pipeline for Claude and Codex, exported through `index.ts`.

- `subscription-usage-api.util.ts`: provider/auth/window types, supported-provider labels derived from strategies, shared fetch timeout and TTL constants, status-discriminated `UsageResult`, injectable API. Classifies no-auth, expired, HTTP errors, network/timeout, unavailable and ok; owns fetch timeout and error catching. Malformed JSON is unavailable; fetch and abort failures remain network.
- `credential-resolver.ts`: verifies stored OAuth auth through PathUtil and RawDataParser, asks the latest host context for refreshed tokens, falls back to stored access. Codex account id comes from stored accountId or defensive JWT decoding.
- `subscription-usage-cache.ts`: shared injected cache with TTL, per-provider in-flight deduplication, forced refresh, retained last-success windows/timestamp, and completion subscribers. Includes provider aliases and soonest-reset window selection.
- `pace.ts`: pure elapsed-window pace and relative reset formatting.
- `progress-bar.ts`: pure percentage clamp and glyph-configurable bar (defaults █/░).
- `provider-color.ts`: fixed shared provider colors (Claude #D97706, Codex #10B981), exported as PROVIDER_USAGE_COLORS and providerUsageColor; no configuration dependency.
- `strategy/`: pure request construction and JSON normalization; no network I/O.

## Flow

Consumers ensure freshness or force refresh → cache picks strategy → API resolves credentials and fetches → strategy parses windows with durations → cache stores status and last success, then notifies subscribers. Footer shows ok windows or last-success windows for network/http-error/unavailable; no-auth/expired hide usage. Other consumers can retain earlier windows alongside failure status.
