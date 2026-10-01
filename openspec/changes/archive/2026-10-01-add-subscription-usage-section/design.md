# Design

## Context

See proposal.md (Why) for motivation. Requirements live in `specs/modal-ui`, `specs/subscription-usage`, and `specs/model-select-sections`.

Current state that shapes the approach:

- `ModalDialog` (`src/libs/modal/modal-dialog.ts`) owns the frame, tab strip, one navigation scheme, an optional filter, notices, layers, and the footer. The modal contract does not allow a filter and a command-style (Vim) scheme in the same dialog.
- `ModelSelectDialog` (`src/extensions/model-select/model-select-dialog.ts`) wraps one `ModalDialog` that uses a filter and `PiKeybindingsScheme`. `showModelSelector` mounts it through `presentModal(ctx.ui, config.layout, ...)`. Both the `/select-model` command and `PI_VIM_KEY_EVENT_ID` go through `showModelSelector`.
- `SubscriptionUsageManager` lives in `src/extensions/custom-footer/` and is created per footer component with a single `onUpdate` callback. `SubscriptionUsageApi` reads `auth.json` directly, and strategies return `RateWindow[] | undefined`, so every failure looks the same.
- In pi-tui, `matchesKey('\x1b', 'ctrl+[')` returns `true`. Legacy terminals send the same byte for `Ctrl+[` and Esc. Under the Kitty protocol, `Ctrl+[` arrives as a distinct CSI-u sequence.
- `libs/modal` must import only Pi host packages. This is enforced by `test/modal/dependency-audit.test.ts`.

## Goals / Non-Goals

**Goals:**
- A generic sectioned host in `libs/modal` that reuses `ModalDialog` unchanged in behavior. Existing single-dialog consumers (Context View, today's model-select) are unaffected.
- One usage data pipeline (credentials, fetch, status classification, cache) shared by the footer and the Usage section.
- Strategies that are pure: they build a request and parse JSON, with no I/O error handling of their own, so they are easy to test.

**Non-Goals:**
- No new configuration options: no section toggles, no keybinding config, no usage section layout config. (Two existing color options are removed; see D10.)
- No usage history or persistence. Pace comes only from the current window position.
- No new providers beyond Anthropic and OpenAI Codex.
- No live badge in the section strip or footer changes beyond switching to the shared cache.
- No background timer while the Usage section is not visible (see D12 for the visible-only tick).

## Decisions

### D1. Compose embedded `ModalDialog`s instead of adding sections to `ModalDialog`
A new `SectionedModal<TResult>` in `src/libs/modal/sectioned-modal.ts` holds `ModalSection[]`, where each section is `{ label, dialog: ModalDialog<TResult>, onActivate? }`. It owns the frame, the section strip, section-key routing, focus propagation, and completion. Every other input goes to the active section's `dialog.handleInput`.

- *Alternative:* a `sections` option on `ModalDialog` that moves tabs, navigation, filter, title, and notices into per-section objects. Rejected: it would make the core class larger, and every existing option would need a per-section variant and a compatibility path.
- *Why:* sections need their own navigation scheme and filter, because the filter-vs-Vim rule applies per section. That is exactly what one `ModalDialog` already encapsulates, and state retention (tabs, filter query, layers) comes for free because each dialog instance keeps living while inactive.

### D2. Embedded mode for `ModalDialog`
Extend `ModalFrame` with `'none'`: render only the content lines, with no rules or border. Add an optional `extraHints?: Hint[] | (() => Hint[])` that goes into the footer before the `Esc` hint. `SectionedModal` creates section dialogs with `frame: 'none'` and `extraHints: [['^]/^[', 'Section']]` when it has more than one section. It draws the chosen frame (`inline` or `bordered`, from `presentModal`) around the active dialog's lines.

- For bounded (`'half'`) dialogs, the embedded chrome calculation stays correct because it already reserves 2 lines for frame rules, which the host still draws.
- Completion: a section dialog's `onComplete` forwards to the sectioned modal's single `onComplete`. That covers both a confirm (a model) and a cancel (`cancelValue`), so dismissing with no layer from any section closes the whole modal.

### D3. Section key routing and the bare-Esc rule
`SectionedModal.handleInput` checks section keys first:
- `matchesKey(data, 'ctrl+]')` → next section
- `data !== '\x1b' && matchesKey(data, 'ctrl+[')` → previous section

Everything else, including bare `\x1b`, goes to the active dialog. After a switch, it calls the outgoing dialog's scheme reset, exposed through a small `resetNavigation()` method on `ModalDialog`, so `gg` chords do not leak. On the first activation of a section in an opening, it calls `onActivate`.

- *Alternative:* `alt+[` / `alt+]` (sends `\x1b[`, which clashes with CSI prefixes) or `ctrl+left` / `ctrl+right` (used for word movement in the filter input). Rejected.
- Terminals without the Kitty protocol therefore treat `Ctrl+[` as Esc, while `Ctrl+]` works everywhere.

### D4. Section strip drawn in the frame
Add `src/libs/modal/section-strip.ts` with `renderSectionRule(theme, labels, activeIndex, width, corners?)`. It produces `── Select Model ── Usage ─────...` for inline frames, or `╭─ Select Model ─ Usage ───...╮` for bordered frames. The active label is accent + bold, inactive labels are muted, and the rule glyphs use the border color. When the labels overflow, it reuses the tab strip's windowing logic: extract the shared window computation from `tab-strip.ts` into a helper both call, keep the active label, and add `…` markers. It falls back to only the active label when the width is very small.

- *Alternatives considered:* a filled-background pill line (costs a line, and `selectedBg` is barely visible in some themes) and an underlined strip (costs two lines). Rejected in favour of zero added height and a structural distinction: sections live in the frame, tabs in the body.

### D5. Model selector composition
Split `ModelSelectDialog` into two parts:
- a builder that creates the Select Model section: today's `ModalDialog` configuration with `frame: 'none'`.
- a `ModelSelectModal` component (`SectionedModal<DialogResult>`) that composes the Select Model section and the Usage section.

`showModelSelector` mounts `ModelSelectModal` through `presentModal`, keeping the exact-match and non-UI paths unchanged. The event path already goes through `showModelSelector`, so it gets sections with no extra code. `DialogResult` stays `Model | null`, and the Usage section never completes with a value.

### D6. Usage section UI
Add `src/extensions/model-select/usage-section/`:
- `UsageProviderTab implements ModalTab`, one per supported provider. Each has a `ListNavigator` over window rows and a `RenderCache`.
- A section builder that creates a `ModalDialog` with `VimNavigationScheme`, no filter, `frame: 'none'`, and `initialTabIndex` set to the current model's provider (via `resolveSupportedProvider`), else 0.

Tab content:
- A header line: provider label on the left, and on the right either `updated Ns ago` or a status message (loading, not logged in, expired, HTTP n, network, no data).
- A blank line.
- One row per window: label, progress bar, `NN%`, `resets 2h13m`, pace. `ahead` is shown in warning style and `limit` in error style.

`r` is not mapped by the Vim scheme, so it reaches the active tab as a raw key and forces a refresh of that tab's provider. `onActivate` (first activation) calls `ensureFresh` for every supported provider. The section subscribes to cache updates to call `tui.requestRender()`, and unsubscribes when the modal completes.

- Progress bar glyphs: move the pure `clampPercent` / `renderProgressBar` helpers from `custom-footer/progress-bar.ts` into `libs/subscription-usage/`. The footer passes its configured icons, and the section uses the defaults (no dependency on footer config).

### D7. Shared cache with subscribers, injected from the root
Move and generalize the manager into `src/libs/subscription-usage/subscription-usage-cache.ts`:
- per-provider `{ result, lastSuccess?: { windows, fetchedAt }, lastAttemptAt, inFlight }`
- `ensureFresh(provider)` (respects the TTL)
- `refresh(provider)` (forced, skipped while in flight)
- `get(provider)`
- `subscribe(listener): () => void`, which replaces the single `onUpdate`

`src/index.ts` creates one instance and passes it through deps to `registerCustomFooter` and `registerModelSelect`, the same way `config` is passed today.

- *Alternative:* a module-level singleton. Rejected because it is harder to isolate in tests and conflicts with the existing DI style.

### D8. Status classification inside the API; pure strategies
The strategy interface becomes `{ provider, label, request(auth): Request, parse(json): RateWindow[] }`. `SubscriptionUsageApi.fetchUsage(strategy)` resolves credentials and then:
- no credentials → `no-auth`
- fetches with the existing timeout
- 401/403 → `expired`
- other non-2xx → `http-error(status)`
- thrown error or abort → `network`
- empty parse result → `unavailable`
- otherwise → `ok`

The result type is a discriminated union: `{ status: 'ok', label, windows } | { status: 'no-auth' | 'expired' | 'network' | 'unavailable', label } | { status: 'http-error', label, httpStatus }`.

Strategies set `windowSeconds`:
- Claude: 18000 for `5h`, 604800 for `Week`
- Codex: `limit_window_seconds`, else the existing fallbacks

Pace (`computePace(window, now)`) and `formatResetDescription` are pure functions in the lib.

### D9. Credentials via host auth, with a verified fallback for account id
The API takes an injected `CredentialResolver = (provider) => Promise<ProviderAuth | undefined>`. The default resolver:
- uses the latest `ExtensionContext` (captured on `session_start`)
- calls `ctx.modelRegistry.getProviderAuth(provider)` to get `auth.apiKey`, which goes through the host runtime and should refresh OAuth tokens
- takes the Codex `ChatGPT-Account-Id` from the host auth headers or env if present, otherwise reads `accountId` from `auth.json` as today

The first implementation task verifies that host refresh and header behavior against the installed Pi version. If `getProviderAuth` does not return OAuth access tokens for these providers, the resolver falls back to today's `auth.json` read. The spec only requires that credentials come from host provider authentication when available, so that fallback does not change behavior.

**Spike finding (task 1.1, Pi 0.99.2):**
- `modelRegistry.getProviderAuth(id)` goes through `pi-ai` `resolveProviderAuth`. For a stored OAuth credential, `resolveStoredOAuth` refreshes the token under a lock when fewer than 5 minutes remain, then returns `{ auth: { apiKey: access } }`. No headers are returned; both the `anthropic` and `openai-codex` `toAuth` return only `apiKey`.
- With no stored credential, it falls back to ambient API keys (for example `ANTHROPIC_API_KEY`). Those are not subscription tokens.
- The Codex account id is not exposed by the host. It is in `auth.json` (`accountId`) and in the access-token JWT claim `https://api.openai.com/auth`.`chatgpt_account_id`.

**Chosen resolver path:**
1. Read the stored `auth.json` entry for the provider. If it is missing, or `type` is set to something other than `oauth` → `no-auth`. This keeps ambient API keys out.
2. Get a token from `ctx.modelRegistry.getProviderAuth(provider)` → `auth.apiKey`, which is refreshed by the host. If the host call throws or returns nothing, fall back to the stored `access`.
3. For Codex, the account id comes from the stored `accountId`, else from the JWT claim of the resolved token.

### D10. Fixed provider colors owned by the usage library (review follow-up)
Move the provider-to-color mapping out of `custom-footer` into `src/libs/subscription-usage/provider-color.ts`: `PROVIDER_USAGE_COLORS: Record<SubscriptionProvider, string>` (`anthropic` `#D97706`, `openai-codex` `#10B981`) and `providerUsageColor(provider)`. Remove `anthropicUsage` / `codexUsage` from the footer colors schema. Zod objects strip unknown keys, so existing configs still load. Regenerate `assets/config.schema.json`. The footer and the Usage section both call the lib helper, so model-select no longer imports footer internals or reads footer config.

- *Alternative:* keep the config and read it through a shared config helper. Rejected by the user for simplicity.

### D11. Footer keeps the last good data on temporary failures (review follow-up)
The footer renders from `entry.result.windows` when the status is `ok`. For `network`, `http-error`, and `unavailable`, it falls back to `entry.lastSuccess.windows`. For `no-auth` and `expired`, it hides the segment. This restores the pre-change behavior for temporary errors, while auth problems (which need a re-login) still clear the segment.

### D12. Live Usage section and lifecycle cleanup (review follow-up)
- `ModelSelectModal` starts one 1s interval on construction. The callback calls `tui.requestRender()` only while the Usage section is active, so the freshness line and reset countdowns tick.
- `ModelSelectModal.dispose()` (Pi calls `component.dispose?.()` on close) clears the interval and unsubscribes the cache listener. `onDone` does the same cleanup, and the cleanup is idempotent.
- `UsageProviderTab`'s render cache is keyed on `Math.floor(now / 1000)` so it can actually hit between ticks.
- While a fetch is in flight and data is shown, the header status reads `refreshing…`.
- `SubscriptionUsageApi` classifies a `response.json()` failure as `unavailable` instead of `network`.
- `SUBSCRIPTION_USAGE_TTL_MS` moves into the lib and the cache uses it by default. `SUBSCRIPTION_PROVIDERS` labels come from the strategies' `label` fields. `SectionedModal` exports a `SectionFrame` type used by model-select instead of re-narrowing.

## Risks / Trade-offs

- [Users who customized usage colors lose that option] → This is intentional. Keys are ignored rather than rejected, and it is noted as BREAKING in the proposal and changeset.

- [`Ctrl+[` switches sections only under the Kitty protocol] → Bare-Esc rule plus `Ctrl+]` wrap-around works in every terminal. The hint shows both keys.
- [Inline modal height changes on section switch (natural height)] → The user accepted this. Both sections are short, so the reflow is small.
- [`getProviderAuth` behaviour for OAuth providers is not yet verified] → Verification task first (D9), with a fallback to the existing `auth.json` read.
- [Usage endpoints are undocumented or private and may change shape] → Pure `parse` functions return `unavailable` on unknown shapes. Tests use recorded fixtures.
- ["updated N ago" goes stale while the modal sits idle] → It is re-evaluated on every render (any key or fetch completion). No timer, to avoid background renders. Acceptable for this view.
- [Moving the manager changes footer internals] → Keep the footer tests as regression coverage. The footer spec behavior (soonest reset window, hide on failure) is asserted explicitly.
- [Section strip windowing duplicates tab strip logic] → Extract a shared windowing helper instead of copying it.

## Migration Plan

This is an internal refactor plus a UI addition, with no config or data migration. Rollback means reverting the change. The footer's visible behavior does not change.
