# Design

## Context

Subscription usage lives in `src/libs/subscription-usage/`. Each provider is a `SubscriptionUsageStrategy` (`request(auth)` + `parse(json)`), driven by `SubscriptionUsageApi.fetchUsage` and cached by `SubscriptionUsageCache`. Consumers are the custom footer and the model selector Usage section. Current constraints that shape this change:

- `credential-resolver.ts` reads `~/.pi/agent/auth.json`, rejects any entry whose `type` is not `oauth`, prefers `ctx.modelRegistry.getProviderAuth(provider)`, and falls back to `stored.access`. An `api_key` entry stores its secret in `key`, so both the gate and the fallback exclude OpenCode Go today.
- `SubscriptionProvider` is the union `'anthropic' | 'openai-codex'`; `SUBSCRIPTION_PROVIDERS` drives the Usage tabs and `resolveSupportedProvider` maps model providers. The cache picks a strategy with a two-way ternary.
- The footer's `isUsingSubscription` returns true only for `kimi-coding` or OAuth subscription providers, which gates the usage segment and the ` (sub)` cost suffix.
- `RawDataParser.numberValue` already accepts numeric strings.
- Pi's host resolves `api_key` entries (and an `OPENCODE_API_KEY` env fallback shared with `opencode`) through `getProviderAuth`.

Observed response from `GET https://opencode.ai/console/api/go/status` (Bearer = Go API key): `access.startsAt/endsAt` is the billing period; `access.meters.{fiveHour,week,month}` each carry `resetsAt`, `limitMicroCents`, `usedMicroCents` (digit strings), and `startsAt` except for `month`.

## Goals / Non-Goals

**Goals:**
- Add OpenCode Go as a third provider using the existing strategy, status, pace, and cache machinery unchanged.
- Make the auth-type gate a per-provider property instead of a global OAuth assumption.

**Non-Goals:**
- Exposing dollar amounts or extending `RateWindow` with absolute values.
- Supporting env-only credentials or the Zen provider `opencode`.
- Changing the OpenAI Codex `accountId` handling.

## Decisions

### Per-provider accepted auth types
Each provider declares which `auth.json` entry types it accepts: `anthropic` and `openai-codex` accept `oauth`, `opencode-go` accepts `api_key`. The resolver keeps requiring an `auth.json` entry for the provider (so env-only keys yield `no-auth`), checks the type against the provider's list, then prefers the host-resolved token and falls back to `stored.access` for `oauth` or `stored.key` for `api_key`.
- Declare accepted types on the strategy (or a provider metadata table next to `SUBSCRIPTION_PROVIDERS`) so adding providers stays local. The resolver receives a provider id, so a small lookup table keyed by `SubscriptionProvider` is the simplest fit.
- Keep the legacy rule that an entry with no `type` is treated as `oauth`, preserving current behavior for Claude and Codex.
- Alternative rejected: dropping the type check. An Anthropic API key would then hit the OAuth usage endpoint, return 401, and show as `expired`.

### OpenCode Go strategy
New `strategy/opencode-go-usage.strategy.ts` with `provider = 'opencode-go'`, `label = 'OC-GO'`. The label feeds the Usage tab (`[OC-GO]`), the Usage header, and the footer response label.
- `request`: `GET https://opencode.ai/console/api/go/status`, `Authorization: Bearer <key>`.
- `parse`: read `access`; for `fiveHour`, `week`, `month` in that order, compute `usedPercent = used / limit * 100`, `resetAt = resetsAt`; skip a meter whose limit is not positive, used is missing, or reset is not a valid date. Missing `access`/`meters` gives `[]` → `unavailable` via the existing API path.
- Duration: `resetsAt - startsAt` when both are valid and positive; for `month` the start is `access.startsAt`. Fallbacks: 5h for `fiveHour`, 7d for `week`, unknown for `month` (pace then unknown per the existing pace rule). A 30-day guess for `month` was rejected because billing months vary and a wrong duration produces a misleading pace.
- Used amount: treat an absent field as unusable rather than 0; guard against `Number(null)`/`Number('')` coercing to 0 by checking the raw value is a non-empty string or number before parsing.

### Provider registry wiring
Extend `SubscriptionProvider` with `'opencode-go'`, append it to `SUBSCRIPTION_PROVIDERS` (tab order Claude, Codex, OC-GO), map only `opencode-go` in `resolveSupportedProvider`, add `#00ADD8` to `PROVIDER_USAGE_COLORS`, and replace the cache's strategy ternary with a lookup keyed by provider so the compiler enforces exhaustiveness.

### Footer subscription detection
Add `opencode-go` alongside the existing `kimi-coding` exception in `isUsingSubscription`. This both shows the usage segment and adds ` (sub)` to the cost, which is accurate for a flat-rate plan. Alternative rejected: decoupling the usage segment from subscription detection, which would change behavior for every provider.

## Risks / Trade-offs

- [Undocumented endpoint `console/api/go/status` may change shape or path] → Parser is defensive; a shape change degrades to `unavailable`, and the footer keeps last good windows per existing tolerance rules.
- [The endpoint may reject the key with 401/403 for a lapsed subscription] → Surfaces as `expired`, which the footer hides and the Usage tab explains; acceptable without special-casing.
- [Same key is shared by `opencode` (Zen)] → Only `opencode-go` maps to the provider, so Zen sessions never show Go meters.
- [Response for a non-subscriber is unverified] → Covered by the "no access → unavailable" path; confirm with a test fixture once observed.
