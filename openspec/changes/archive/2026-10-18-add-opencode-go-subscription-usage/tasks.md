# Tasks

## 1. Provider registry

- [x] 1.1 Extend `SubscriptionProvider` with `'opencode-go'`, append `{ provider: 'opencode-go', label: 'OC-GO' }` to `SUBSCRIPTION_PROVIDERS` after Codex, and verify `bun run type-check` flags every exhaustive map that needs the new key
- [x] 1.2 Map only `opencode-go` (not `opencode`) in `resolveSupportedProvider` and verify with cache tests that `opencode-go` resolves and `opencode` returns undefined
- [x] 1.3 Add `'opencode-go': '#00ADD8'` to `PROVIDER_USAGE_COLORS` and verify `test/subscription-usage/provider-color.test.ts` covers it
- [x] 1.4 Replace the cache's anthropic/codex strategy ternary with a provider-keyed strategy lookup and verify cache tests pass, including a fetch routed to the OpenCode Go strategy

## 2. OpenCode Go strategy

- [x] 2.1 Create `src/libs/subscription-usage/strategy/opencode-go-usage.strategy.ts` with `request` (`GET https://opencode.ai/console/api/go/status`, Bearer key) and export it from `index.ts`; verify a strategies test asserts URL, method, and Authorization header
- [x] 2.2 Implement `parse` mapping `fiveHour`/`week`/`month` to `5h`/`Week`/`Month` with used percent from used/limit (digit strings accepted) and reset from `resetsAt`; verify with a fixture based on the observed response (5h ≈ 1.8%, Week ≈ 2.4%, Month ≈ 1.5%)
- [x] 2.3 Implement durations (`resetsAt - startsAt`, month from `access.startsAt`, fallbacks 5h/7d, month unknown) and verify tests for response-derived durations, the 30-day month case, the fiveHour fallback, and month without a period start having unknown pace
- [x] 2.4 Skip unusable meters (non-positive limit, missing used, invalid reset) and return `[]` when `access`/`meters` is missing; verify tests show a skipped meter leaves the others intact and an API test shows no meters yields `unavailable`

## 3. Credential resolution

- [x] 3.1 Add per-provider accepted auth types (`anthropic`/`openai-codex`: `oauth`, with missing `type` treated as `oauth`; `opencode-go`: `api_key`) and gate the resolver on them; verify credential-resolver tests for an anthropic `api_key` entry → undefined and an opencode-go `oauth` entry → undefined
- [x] 3.2 Fall back to `stored.key` for `api_key` entries (keeping `stored.access` for `oauth`) when host resolution fails or returns nothing; verify a test where `getProviderAuth` throws and the opencode-go key is returned
- [x] 3.3 Verify a test where `auth.json` has no `opencode-go` entry but the host would resolve a key (env) still returns undefined, and an existing-behavior test for Codex `accountId` still passes

## 4. Consumers and docs

- [x] 4.1 Treat `opencode-go` as a subscription model in `footer-component.ts` `isUsingSubscription`; verify footer tests show ` (sub)` and the OC-GO usage segment for `opencode-go`, and neither for `opencode`
- [x] 4.2 Verify model-select usage-section tests show tabs `[Claude] [Codex] [OC-GO]` and preselect `OC-GO` when the current provider is `opencode-go`
- [x] 4.3 Update README subscription usage sections (supported providers, `[OC-GO]` tab, color `#00ADD8`, API-key note) and the `src/libs/subscription-usage/codemap.md` provider list; verify by reading the rendered sections
- [x] 4.4 Run `bun test`, `bun run type-check`, and `bun run lint`, and verify all pass
