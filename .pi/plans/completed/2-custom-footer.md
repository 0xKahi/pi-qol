# Plan: `custom_footer` extension

> Replaces pi's built-in interactive footer with a customized one when
> `custom_footer.enabled` is true. Same three-line layout as the built-in footer
> (path → token stats + model → optional extension statuses) with these changes:
> directory shown as `<icon> basename(cwd)`, conditional token/cache rendering,
> a custom cache cluster, an optional subscription-usage progress bar, and
> per-element hex-color overrides. When disabled, leaves pi's default footer
> untouched.

This document is written for an implementing agent. Read it top to bottom before
writing code. It assumes the conventions used by the existing extensions in this
repo (`auto-session-name`, `model-select`).

---

## 0. Context you must internalize first

### 0.1 Repo conventions (mirror `model-select` / `auto-session-name`)
- `src/index.ts` — thin default-export factory. Instantiates one shared
  `ConfigLoader`, loads config on `session_start`, then calls each extension's
  `register<Name>(pi, { config })`. **Edit it to add `registerCustomFooter`.**
- `src/config-loader.ts` — central zod loader. Holds in-memory `Config`, exposes
  `isEnabled(key)` + per-extension getters, merges global then project config
  (project gated on `isProjectTrusted()`), validates with zod. **Add
  `getCustomFooter()`.**
- `src/constants.ts` — `EXTENSION_ID = 'pi-qol'`, `COLOR_HEX_REGEX`,
  `SUB_EXTENSION_IDS`, `piVimKeyEventId`. **Add `custom_footer` to
  `SUB_EXTENSION_IDS`.**
- `src/schemas/*.schema.ts` — zod v4 schemas composed into `config.schema.ts`.
  `custom_footer-config.schema.ts` **already exists** (see §2). `config.schema.ts`
  already wires `custom_footer` into both `ConfigSchema` and `PartialConfigSchema`.
- `src/utils/crayon.util.ts` — `crayon.colorize(text, { fg, bg })` renders 24-bit
  hex ANSI (no-op when hex invalid/undefined), `crayon.stripAnsi`,
  `crayon.reverseVideo`. **Use this for hex-color overrides** (directory, model
  name, provider usage colors, progress-bar fill).
- `src/libs/subscription-usage/` — `SubscriptionUsageApi` + per-provider
  strategies. **Already exists** (see §0.4). Use as-is.
- `src/extensions/custom-footer/constants.ts` — **already exists**:
  `FILLED_BAR_ICON='█'`, `EMPTY_BAR_ICON='░'`, `SUBSCRIPTION_BAR_WIDTH=10`.
- `scripts/build-schema.ts` → `bun run buildSchema` regenerates
  `assets/config.schema.json` from `ConfigSchema`.
- Style: zod v4, single quotes, `arrowParentheses: asNeeded`, lineWidth 150,
  organizeImports. Run `bun run check` (biome fix + tsc) + `bun test` before done.

### 0.2 The enabled-guard rule (critical)
The enabled decision lives at **runtime**, not at registration time. But unlike
the command-based extensions, a footer is **installed once** via
`ctx.ui.setFooter(factory)`. Follow the `model-select` pattern: register a
`session_start` handler that, when `config.isEnabled('custom_footer')` is true and
not yet installed, calls `ctx.ui.setFooter(...)` once. The footer component itself
reads live config + session data on every `render()`, so per-project toggles and
`/reload` behave (see §6.4 for the disabled→enabled / enabled→disabled edge cases).

### 0.3 Key pi SDK facts (verified against `node_modules/@earendil-works/*`)
- **Installing a custom footer**: `ctx.ui.setFooter(factory | undefined)`.
  - `factory: (tui: TUI, theme: Theme, footerData: ReadonlyFooterDataProvider) =>
    Component & { dispose?(): void }`.
  - Pass `undefined` to restore the built-in footer.
  - `ctx.ui` is `ExtensionUIContext`; `setFooter` is on it
    (`core/extensions/types.d.ts:106`).
- **`Component`** (`@earendil-works/pi-tui`, `tui.d.ts:10`):
  - `render(width: number): string[]` — return one string per line. Called every
    render cycle, so read fresh data here.
  - `invalidate(): void` — required; clear any cached state. Safe to no-op.
  - optional `dispose?()` — clean up timers/listeners.
- **`ReadonlyFooterDataProvider`** (`core/footer-data-provider.d.ts`): the only data
  not otherwise reachable —
  - `getGitBranch(): string | null` (`null` = not a repo, `"detached"` = detached HEAD)
  - `getExtensionStatuses(): ReadonlyMap<string, string>`
  - `getAvailableProviderCount(): number`
  - `onBranchChange(cb): () => void`
- **Session/token/model data** comes from `ctx` (NOT the footer factory args).
  Capture `ctx` in `session_start` and close over it in the component:
  - `ctx.sessionManager.getEntries(): SessionEntry[]` — message entries are
    `{ type: 'message', message: AgentMessage }`; assistant messages carry
    `message.usage: Usage`.
  - `ctx.sessionManager.getCwd(): string`, `ctx.sessionManager.getSessionName(): string | undefined`.
  - `ctx.getContextUsage(): { tokens: number|null; contextWindow: number; percent: number|null } | undefined`
    — use this directly (handles compaction → `percent: null` shows `?`). Do NOT
    reimplement `estimateContextTokens`.
  - `ctx.model: Model<Api> | undefined` — `.id`, `.provider`, `.contextWindow`,
    `.reasoning`.
  - `ctx.modelRegistry.isUsingOAuth(model): boolean` — subscription gate.
  - There is no live `thinkingLevel` on `ctx`. The built-in footer reads it from
    interactive state, which extensions cannot access. **Decision: render the
    thinking indicator only if you can source it; otherwise omit it** (document
    this as a known difference from the built-in footer). Prefer matching built-in
    output for everything else.
- **`Usage`** shape (`pi-ai/dist/types.d.ts:177`): `{ input, output, cacheRead,
  cacheWrite, cacheWrite1h?, totalTokens, cost: { input, output, cacheRead,
  cacheWrite, total } }`.
- **`Theme.fg(color: ThemeColor, text)`** — wrap text in a theme color. Use
  `theme.fg('dim', ...)`, `theme.fg('error', ...)`, `theme.fg('warning', ...)`
  exactly like the built-in footer. `'dim'` is the default footer color.
- **`pi-tui` utils** (`pi-tui/dist/index.d.ts:23`): `truncateToWidth(text, width,
  ellipsis)`, `visibleWidth(text)`. Use these for width math (they are
  ANSI-aware), mirroring the built-in footer.
- **Re-render on async data**: the factory receives `tui`; call
  `tui.requestRender()` after the background subscription-usage fetch resolves so
  the new bar shows up without waiting for the next natural render.

### 0.4 Subscription usage lib (already built — use as-is)
`src/libs/subscription-usage/subscription-usage-api.util.ts`:
- `class SubscriptionUsageApi`:
  - `fetchUsage(strategy): Promise<FetchUsageResponse | undefined>` where
    `FetchUsageResponse = { label: string; rateWindow: RateWindow[] }` and
    `RateWindow = { label: string; usedPercent: number; resetAt?: Date }`.
    Returns `undefined` when the provider has no OAuth auth in `auth.json` or the
    fetch yields nothing.
  - `formatResetDescription(date: Date): string` → `"now" | "45m" | "2h30m" | "3d4h"`.
- Strategies (each is `SubscriptionUsageStrategy` with `.provider`, `.label`,
  `.fetchUsage(auth)`):
  - `AnthropicOauthUsageStrategy` — `provider='anthropic'`, `label='Claude'`.
  - `OpenAiCodexUsageStrategy` — `provider='openai-codex'`, `label='Codex'`.
- These perform real network calls; treat them as async + best-effort. Never block
  `render()` on them (see §5).

> NOTE the spec text says it picks `FetchUsageResponse.label` + a rate window.
> `FetchUsageResponse.label` is the provider label ("Claude"/"Codex"); the rate
> window's own `label` ("5h"/"Week"/...) is the window label. Both are used (see §4.3).

---

## 1. Files to create / edit

```
src/
  schemas/
    custom-footer-config.schema.ts      # EXISTS — verify only (see §2)
    config.schema.ts                    # EXISTS — already wires custom_footer; verify (see §2.2)
  config-loader.ts                      # (edit)   add getCustomFooter()
  constants.ts                          # (edit)   add custom_footer to SUB_EXTENSION_IDS
  index.ts                              # (edit)   call registerCustomFooter(pi, { config })
  extensions/
    custom-footer/
      constants.ts                      # EXISTS — bar icons + width (may extend, see §5)
      index.ts                          # (author) registerCustomFooter + session_start install
      footer-component.ts               # (author) FooterComponent implements Component
      token-stats.ts                    # (author) pure: compute + format token/cache cluster
      subscription-usage-manager.ts     # (author) background fetch + cache + provider resolution
      progress-bar.ts                   # (author) pure: render solid progress bar
      types.ts                          # (author) shared local types (CachedUsage, etc.)
test/
  custom-footer/
    token-stats.test.ts                 # (author) formatTokens + cluster assembly + conditionals
    progress-bar.test.ts                # (author) bar fill math + edge cases
    subscription-usage-manager.test.ts  # (author) provider resolution + cache (inject fake api)
assets/config.schema.json               # (generated) via bun run buildSchema
README.md                               # (edit, optional) document custom_footer config
```

> Keep everything extension-specific under `src/extensions/custom-footer/`. Shared
> infra stays at `src/` root. Factor all width-independent logic (token formatting,
> bar rendering, provider/window selection, cache assembly) into pure functions so
> they are unit-testable without a TUI.

---

## 2. Config schema (already authored — verify, do not rewrite)

### 2.1 `src/schemas/custom-footer-config.schema.ts` (EXISTS)
Current shape (confirm it still matches before coding):
```ts
const CustomFooterColorsSchema = z.object({
  directory: ColorHexSchema.optional(),
  modelName: ColorHexSchema.optional(),
  anthropicUsage: ColorHexSchema.optional().default('#D97706'),
  codexUsage: ColorHexSchema.optional().default('#10B981'),
});
const CustomFooterIconsSchema = z.object({
  directory: z.string().optional().default(' '),   // nerd-font glyph + space
  refresh: z.string().optional().default(''),
  cache: z.string().optional().default(' '),
  cacheRead: z.string().optional().default(' '),
  cacheWrite: z.string().optional().default(' '),
});
const CustomFooterDisplaySchema = z.object({
  tokens: z.boolean().optional().default(true),
  cache: z.boolean().optional().default(true),
});
export const CustomFooterConfigSchema = z.object({
  enabled: z.boolean().default(false),
  colors: CustomFooterColorsSchema.optional(),
  icons: CustomFooterIconsSchema.optional(),
  display: CustomFooterDisplaySchema.optional(),
});
```
**Caveat (read this):** `colors`, `icons`, `display` are `.optional()` *objects*. If
a user omits them entirely, `config.custom_footer.icons` is `undefined` — the inner
`.default(...)` values only apply when the object is present. **Decision:** in the
schema, give the three sub-objects a default so their inner defaults always
materialize. Change each to `.default({})`, e.g.:
```ts
colors: CustomFooterColorsSchema.default({}),
icons: CustomFooterIconsSchema.default({}),
display: CustomFooterDisplaySchema.default({}),
```
This way `icons.directory`, `display.tokens`, `colors.anthropicUsage` etc. are
always defined and the component code needs no per-field `??` fallbacks. (If you
prefer to keep them optional, the component MUST coalesce every field — more
error-prone. Recommend `.default({})`.) After changing, re-run `bun run buildSchema`.

> Note the icon defaults contain nerd-font glyphs (``, ``, ``, ``). Keep them.
> They render as boxes without a nerd font but that is the user's terminal concern.

### 2.2 `src/schemas/config.schema.ts` (EXISTS — verify)
Already imports `CustomFooterConfigSchema` and adds `custom_footer` to both
`ConfigSchema` (`.default({ enabled: false })`) and `PartialConfigSchema`
(`.optional()`). No change needed unless you adjust §2.1 defaults. Confirm the
`PartialConfigSchema` entry uses the same schema (it currently reuses
`CustomFooterConfigSchema`, not a partial — acceptable since all fields are
optional/defaulted; leave as-is).

### 2.3 `src/config-loader.ts` (edit)
Add the getter mirroring the others:
```ts
getCustomFooter(): Config['custom_footer'] {
  return this.config.custom_footer;
}
```
`isEnabled('custom_footer')` already works via the generic implementation.

### 2.4 `src/constants.ts` (edit)
Add to `SUB_EXTENSION_IDS`:
```ts
const SUB_EXTENSION_IDS = {
  auto_session_name: 'auto_session_name',
  model_select: 'model_select',
  custom_footer: 'custom_footer',
} as const;
```

---

## 3. Line 1 — path / context info

Build the string, then color + truncate.

Logic (mirror built-in `formatCwdForFooter`, but show basename only):
```ts
import { basename } from 'node:path';

const icons = config.icons;            // always defined after §2.1
const colors = config.colors;

const cwd = ctx.sessionManager.getCwd();
let pwd = `${icons.directory}${basename(cwd)}`;   // e.g. " pi-qol"
```
> The default `icons.directory` already ends with a trailing space (`' '`),
> so concatenate directly (do not add another space). If you prefer an explicit
> space, trim the icon and join with `' '`. Pick one and be consistent; the spec
> example is `` `${icon} ${basename(cwd)}` ``. **Decision: use
> `` `${icons.directory}${basename(cwd)}` `` `` and rely on the icon's trailing
> space**, so a user can supply an icon without a space if they want it tight.

Append, same as built-in:
```ts
const branch = footerData.getGitBranch();
if (branch) pwd = `${pwd} (${branch})`;
const sessionName = ctx.sessionManager.getSessionName();
if (sessionName) pwd = `${pwd} • ${sessionName}`;
```

Color:
- If `colors.directory` is a valid hex → wrap the **icon + basename** portion only
  with `crayon.colorize(text, { fg: colors.directory })`. Branch + session name
  keep the default dim. (Spec: "directory icon and cwd basename" get the color.)
  Simplest correct approach: colorize the `${icon}${basename}` segment first, then
  append the dim branch/session parts, then dim-wrap the whole line is WRONG (dim
  reset would clobber). Instead build the colored basename segment, append branch/
  session as separate dim-wrapped segments, and **do not** dim-wrap the colored
  segment. See the built-in footer's "dim each part separately" comment for the
  exact escape-code hazard.
- If `colors.directory` is not defined → wrap the whole line in `theme.fg('dim', ...)`
  exactly like built-in.

Truncate: `truncateToWidth(line, width, theme.fg('dim', '...'))`.

> Implementation tip: produce line 1 as `segments: string[]` (each already colored)
> joined by the appropriate separators, then a single `truncateToWidth` at the end.
> Be careful: truncating a string that contains ANSI is handled by `truncateToWidth`
> (ANSI-aware), so build the full colored string then truncate once.

---

## 4. Line 2 — token stats (left) + model (right)

Compute cumulative usage by iterating `ctx.sessionManager.getEntries()` exactly
like the built-in footer:
```ts
let totalInput=0, totalOutput=0, totalCacheRead=0, totalCacheWrite=0, totalCost=0;
let latestCacheHitRate: number | undefined;
for (const entry of ctx.sessionManager.getEntries()) {
  if (entry.type === 'message' && entry.message.role === 'assistant') {
    const u = entry.message.usage;
    totalInput += u.input; totalOutput += u.output;
    totalCacheRead += u.cacheRead; totalCacheWrite += u.cacheWrite;
    totalCost += u.cost.total;
    const prompt = u.input + u.cacheRead + u.cacheWrite;
    latestCacheHitRate = prompt > 0 ? (u.cacheRead / prompt) * 100 : undefined;
  }
}
```
Port `formatTokens` verbatim from the built-in footer (`<1000` raw, `<10k` →
`1.5k`, `<1M` → `123k`, `<10M` → `1.2M`, else `12M`). Put it in `token-stats.ts`.

### 4.1 Stats assembly (`token-stats.ts`, pure)
Write `buildStatsLeft({ totals, display, icons, latestCacheHitRate, contextUsage,
autoCompactEnabled, theme })` returning a single (already colored) string. Order
and conditionals:

1. **Tokens** (only if `display.tokens === true`):
   - `↑${formatTokens(totalInput)}` if `totalInput`
   - `↓${formatTokens(totalOutput)}` if `totalOutput`
2. **Cache** (only if `display.cache === true` AND there is cache activity):
   - Custom cluster (replaces built-in `R.. W.. CH..%`):
     ```
     <cache> [<cacheRead><read> <cacheWrite><write> <hit>%]
     ```
     i.e.
     ```ts
     `${icons.cache}[${icons.cacheRead}${formatTokens(totalCacheRead)} ` +
     `${icons.cacheWrite}${formatTokens(totalCacheWrite)} ` +
     `${latestCacheHitRate.toFixed(1)}%]`
     ```
     Render only when `totalCacheRead > 0 || totalCacheWrite > 0`. Include the
     `<hit>%` segment only when `latestCacheHitRate !== undefined` (mirror built-in
     guard). This whole cluster uses **default dim** (no color override).
3. **Cost** (unchanged from built-in): if `totalCost || usingSubscription`, push
   `$${totalCost.toFixed(3)}` + ` (sub)` when
   `ctx.model && ctx.modelRegistry.isUsingOAuth(ctx.model)`.
4. **Context %** (unchanged from built-in): build
   `${percent}%/${formatTokens(contextWindow)}${autoIndicator}` where `percent` is
   `contextUsage.percent?.toFixed(1)` or `'?'` when null, and `autoIndicator` is
   ` (auto)` when auto-compact is enabled (see note below). Colorize via
   `theme.fg('error', ...)` when `percent>90`, `theme.fg('warning', ...)` when
   `>70`, else plain.
5. **Subscription usage** (§4.3): if available, push a separator `•` then the
   subscription segment.

Join parts with `' '`. The built-in footer dims the non-context parts and leaves
the context color intact — replicate the "dim each part separately" handling
(§4.5).

> **auto-compact flag:** the built-in footer is told `setAutoCompactEnabled` by
> interactive mode; extensions can't read it. **Decision:** default the indicator
> to ON (` (auto)`) to match the common case, OR omit the `(auto)` suffix entirely.
> Recommend **omitting `(auto)`** to avoid showing a wrong state. Document as a
> known minor difference. (If a reliable source is found later, wire it.)

### 4.2 Right side — model (`footer-component.ts`)
Mirror built-in:
- `modelName = ctx.model?.id ?? 'no-model'`.
- **Color override:** if `colors.modelName` is valid hex →
  `crayon.colorize(modelName, { fg: colors.modelName })`; else leave for the
  default dim wrap.
- Thinking level: **omit** (no reliable source — see §0.3). If you choose to keep
  parity, gate behind a discovered source; do not fabricate.
- Provider prefix `(provider)`: keep built-in behavior — prepend
  `(${ctx.model.provider})` when `footerData.getAvailableProviderCount() > 1` and
  it fits within width.

### 4.3 Subscription usage segment (the new part)
Only render when:
- `ctx.model` is set, AND
- `ctx.modelRegistry.isUsingOAuth(ctx.model)` is true, AND
- the model's provider maps to a supported provider (`anthropic` or
  `openai-codex`), AND
- the `SubscriptionUsageManager` (§5) has a **cached** `FetchUsageResponse` for
  that provider.

Provider mapping: `ctx.model.provider` → supported provider id. Confirm the exact
provider string pi uses for codex models (could be `'openai-codex'`,
`'openai'`, or similar). **Action for implementer:** at runtime log
`ctx.model.provider` for both an Anthropic-OAuth and a Codex-OAuth session and map
accordingly. Keep the mapping in one place (`subscription-usage-manager.ts`).

Pick the rate window: **the window with the earliest `resetAt`; if none have
`resetAt`, the first window.**
```ts
function pickWindow(windows: RateWindow[]): RateWindow | undefined {
  const withReset = windows.filter(w => w.resetAt);
  if (withReset.length) {
    return withReset.reduce((a, b) => (a.resetAt! <= b.resetAt! ? a : b));
  }
  return windows[0];
}
```

Segment format (after a `•` separator following all token stats):
```
<response_label> <window_label> <progress_bar> <used_percent>% <refresh_icon> <reset_desc>
```
- `<response_label>` = `FetchUsageResponse.label` (e.g. `Claude`/`Codex`)
- `<window_label>` = `window.label` (e.g. `5h`/`Week`)
- `<progress_bar>` = §4.4
- `<used_percent>` = `Math.round(window.usedPercent)` (clamp 0..100) + `%`
- `<refresh_icon>` = `icons.refresh`
- `<reset_desc>` = `window.resetAt ? api.formatResetDescription(window.resetAt) : ''`
  (omit the refresh icon + desc when no `resetAt`).

**Coloring:** the provider color (`colors.anthropicUsage` or `colors.codexUsage`,
per the resolved provider) is the fg of:
- `<response_label>`, `<window_label>`, `<used_percent>`, and the **filled** cells
  of the progress bar.
Everything else (`<window_label>` spacing, empty bar cells, `%`, refresh icon,
reset desc) uses the default dim. Use `crayon.colorize(text, { fg: providerColor })`
for the colored pieces; wrap the rest in `theme.fg('dim', ...)`.

### 4.4 Progress bar (`progress-bar.ts`, pure)
```ts
import { EMPTY_BAR_ICON, FILLED_BAR_ICON, SUBSCRIPTION_BAR_WIDTH } from './constants';

// returns { filled: string; empty: string } so caller can color them separately
export function renderProgressBar(usedPercent: number, width = SUBSCRIPTION_BAR_WIDTH) {
  const pct = Math.max(0, Math.min(100, usedPercent));
  const filledCount = Math.round((pct / 100) * width);
  return {
    filled: FILLED_BAR_ICON.repeat(filledCount),
    empty: EMPTY_BAR_ICON.repeat(width - filledCount),
  };
}
```
Caller colorizes `filled` with the provider color and `empty` with dim, then
concatenates. (Returning the two parts keeps the function pure + testable and
avoids embedding ANSI in the unit-tested output.)

### 4.5 Width math + dim handling (mirror built-in)
Reuse the built-in algorithm verbatim (it is already correct):
1. Compute `statsLeft` (the joined colored stats string) and `statsLeftWidth =
   visibleWidth(statsLeft)`; truncate if it exceeds `width`.
2. Build `rightSide` (model, with optional `(provider)` prefix that is dropped if
   it doesn't fit).
3. If `statsLeftWidth + 2 + rightSideWidth <= width`: pad between them; else
   truncate the right side.
4. **Dim handling:** statsLeft and the colored override segments contain their own
   ANSI resets, which would terminate an outer `theme.fg('dim', ...)` wrapper. Use
   the built-in trick: dim `statsLeft` and the `remainder` (padding + rightSide)
   **separately** so the inner colored sections (context %, provider-usage colors,
   model name override) survive. Read the built-in footer's comment block and copy
   the approach. Where you have already-colored crayon segments embedded, make sure
   the surrounding dim wrap does not swallow them — colorize those segments last
   and exclude them from the dim wrap, OR re-apply dim around them. **Test the
   visual output manually (§7).**

---

## 5. `subscription-usage-manager.ts` — background fetch + cache

`render()` is synchronous; the strategies do network I/O. So fetch out-of-band and
cache the latest result; `render()` only reads the cache.

```ts
import { SubscriptionUsageApi, type FetchUsageResponse, type SubscriptionUsageStrategy } from '../../libs/subscription-usage/subscription-usage-api.util';
import { AnthropicOauthUsageStrategy } from '../../libs/subscription-usage/strategy/anthropic-oauth-usage.strategy';
import { OpenAiCodexUsageStrategy } from '../../libs/subscription-usage/strategy/openai-codex-usage.strategy';

type SupportedProvider = 'anthropic' | 'openai-codex';

export class SubscriptionUsageManager {
  private cache = new Map<SupportedProvider, FetchUsageResponse>();
  private inFlight = new Set<SupportedProvider>();
  private lastFetchAt = new Map<SupportedProvider, number>();
  constructor(
    private api = new SubscriptionUsageApi(),
    private onUpdate?: () => void,            // e.g. () => tui.requestRender()
    private ttlMs = 60_000,
  ) {}

  get(provider: SupportedProvider): FetchUsageResponse | undefined {
    return this.cache.get(provider);
  }

  // Call from render() (cheap). Triggers a background refresh if stale; returns cached.
  ensureFresh(provider: SupportedProvider): FetchUsageResponse | undefined {
    const last = this.lastFetchAt.get(provider) ?? 0;
    if (!this.inFlight.has(provider) && Date.now() - last > this.ttlMs) {
      this.refresh(provider);
    }
    return this.cache.get(provider);
  }

  private refresh(provider: SupportedProvider) {
    this.inFlight.add(provider);
    this.lastFetchAt.set(provider, Date.now());
    void this.api.fetchUsage(this.strategyFor(provider))
      .then(res => { if (res) { this.cache.set(provider, res); this.onUpdate?.(); } })
      .catch(() => {/* swallow — best effort */})
      .finally(() => this.inFlight.delete(provider));
  }

  private strategyFor(provider: SupportedProvider): SubscriptionUsageStrategy {
    return provider === 'anthropic' ? new AnthropicOauthUsageStrategy() : new OpenAiCodexUsageStrategy();
  }
}
```
- `onUpdate` should be `() => tui.requestRender()` so a freshly-fetched bar appears
  promptly. (Component closes over `tui`.)
- TTL prevents hammering the endpoints on every render. 60s is a reasonable
  default; expose as a constant in `extensions/custom-footer/constants.ts` if you
  want it tunable (NOT user config — keep config minimal).
- Provider mapping (`ctx.model.provider` → `SupportedProvider | undefined`) lives
  here too (see §4.3 action item).
- `dispose()`: nothing to clean (no timers) — fetches are fire-and-forget and
  guarded by `inFlight`. If you add an interval timer instead of lazy
  `ensureFresh`, clear it in `dispose()`.

> **Decision: lazy refresh from render() (above) over a setInterval.** It only
> fetches when the footer is actually rendering and the provider is OAuth +
> supported, and naturally stops when not shown. Simpler lifecycle, no timer leak.

---

## 6. `index.ts` — `registerCustomFooter(pi, { config })`

Mirror `registerModelSelect`'s install-once-on-session_start shape.

```ts
import type { ExtensionAPI, ExtensionContext } from '@earendil-works/pi-coding-agent';
import type { ConfigLoader } from '../../config-loader';
import { CustomFooterComponent } from './footer-component';

export function registerCustomFooter(pi: ExtensionAPI, deps: { config: ConfigLoader }) {
  let installed = false;

  pi.on('session_start', (_event, ctx) => {
    if (!deps.config.isEnabled('custom_footer')) return;     // §6.4 edge: see note
    if (installed) return;

    ctx.ui.setFooter((tui, theme, footerData) =>
      new CustomFooterComponent({ tui, theme, footerData, ctx, config: deps.config }),
    );
    installed = true;
  });
}
```

- `src/index.ts` (edit): add `registerCustomFooter(pi, { config })` after the
  existing `registerModelSelect(...)`.
- The component reads `deps.config.getCustomFooter()` and live `ctx` on every
  `render()`, so per-project config differences inside one process apply.

### 6.4 Enabled / disabled edge cases (call out explicitly)
- **Disabled at session_start:** never install → pi keeps its built-in footer. ✅
- **Enabled, then user disables via config + `/reload`:** the component is already
  installed. Two options:
  1. Inside `render()`, if `!config.isEnabled('custom_footer')`, the component
     cannot un-install itself cleanly (it would need `ctx.ui.setFooter(undefined)`).
     **Decision:** in `render()`, when disabled, call
     `ctx.ui.setFooter(undefined)` once (guard with a flag) to restore the built-in
     footer, then return its own last lines or `[]` for the final frame.
     Simpler alternative: just render an empty/minimal footer. Pick the
     `setFooter(undefined)` restore for correctness and document it.
  2. Re-evaluate install on a cheap recurring event (e.g. `session_start` only
     fires once per session). Since `/reload` re-runs the extension factory in pi,
     verify whether `setFooter` resets on reload; if the factory re-runs,
     `installed` resets and the `session_start` guard re-applies. **Action:** verify
     `/reload` semantics for `setFooter` and pick the simplest correct path; note
     the finding in code comments.
- **Keep it simple:** if `/reload` fully re-instantiates the extension (likely),
  the install-once + session_start guard already handles enable/disable correctly
  and you can skip the in-render un-install. Verify first.

---

## 7. Manual verification
1. `bun run check` (biome + tsc) clean; `bun test` green.
2. `bun run buildSchema` updates `assets/config.schema.json`; confirm
   `custom_footer` with `enabled`, `colors`, `icons`, `display`.
3. Live `custom_footer.enabled: true`:
   - Line 1 shows `<dir-icon> <basename> (branch) • <session>`; basename + icon
     pick up `colors.directory` when set, else dim.
   - Line 2 token stats render; `display.tokens:false` hides `↑/↓`;
     `display.cache:false` hides the cache cluster; cache cluster shows
     `<cache>[<r>… <w>… NN.N%]` when cache active.
   - Cost, `(sub)`, and color-coded context % match built-in.
   - With an Anthropic-OAuth or Codex-OAuth model, the subscription segment appears
     after a `•`: `<Claude|Codex> <window> <bar> NN% <refresh> <reset>`, colored
     with the provider color on label/window/percent/filled-bar; bar fills to
     usedPercent.
   - Model name on the right uses `colors.modelName` when set; `(provider)` prefix
     shows with multiple providers when it fits.
4. Negative: `custom_footer.enabled:false` ⇒ built-in pi footer, no override.
5. Non-OAuth model, or unsupported provider ⇒ no subscription segment, rest intact.
6. Width: shrink the terminal; confirm graceful truncation (no broken ANSI, no
   overflow) on all three lines.
7. Async: subscription bar appears within ~1s of the first render (background
   fetch + `tui.requestRender()`), not only after the next keystroke.

---

## 8. Build checklist
- [ ] `src/schemas/custom-footer-config.schema.ts`: change sub-objects to
      `.default({})` (§2.1)
- [ ] `src/schemas/config.schema.ts`: verify `custom_footer` wired (already done)
- [ ] `src/config-loader.ts`: add `getCustomFooter()`
- [ ] `src/constants.ts`: add `custom_footer` to `SUB_EXTENSION_IDS`
- [ ] `src/extensions/custom-footer/types.ts`
- [ ] `src/extensions/custom-footer/token-stats.ts` (formatTokens + buildStatsLeft, pure)
- [ ] `src/extensions/custom-footer/progress-bar.ts` (pure)
- [ ] `src/extensions/custom-footer/subscription-usage-manager.ts` (cache + lazy refresh + provider map)
- [ ] `src/extensions/custom-footer/footer-component.ts` (Component: 3-line render, width math, dim handling)
- [ ] `src/extensions/custom-footer/index.ts` (`registerCustomFooter`, install-once on session_start)
- [ ] `src/index.ts`: call `registerCustomFooter(pi, { config })`
- [ ] tests: `token-stats`, `progress-bar`, `subscription-usage-manager`
- [ ] `bun run buildSchema`, `bun run check`, `bun test` all pass
- [ ] README documents `custom_footer` config + known differences (no thinking
      level, no `(auto)` indicator)

---

## 9. Pitfalls / gotchas
- **Footer factory args are `(tui, theme, footerData)` — NOT `ctx`.** Token/model/
  context data come from `ctx`, which you must capture in `session_start` and close
  over in the component. Read fresh on every `render()`.
- **Use `ctx.getContextUsage()`** for context %; do not reimplement token
  estimation. It already returns `percent: null` (render `?`) after compaction.
- **Never block `render()` on network.** Subscription usage is fetched in the
  background and cached; render reads the cache. Trigger `tui.requestRender()` when
  the cache updates.
- **ANSI/dim nesting bug.** Colored segments (crayon hex + theme color codes) embed
  their own resets; an outer `theme.fg('dim', whole)` wrapper will be cut short at
  the first reset. Replicate the built-in footer's "dim parts separately" approach
  and verify visually.
- **`icons.directory` default has a trailing space.** Don't double-space.
- **`.optional()` sub-objects** in the schema mean inner `.default(...)` won't
  apply unless the object exists — switch to `.default({})` (§2.1) or coalesce
  every field in code.
- **Provider id for Codex is unverified.** Log `ctx.model.provider` for a real
  Codex-OAuth session and map it; keep the mapping in one place.
- **Subscription strategies hit live endpoints.** Treat all failures as "no
  segment" — swallow errors, never surface to the user or throw into render.
- **`usedPercent` may exceed 100 or be fractional.** Clamp 0..100 and round for
  display; clamp before computing bar fill.
- **Enable/disable via `/reload`.** Verify whether the factory re-runs and
  `setFooter` resets; prefer the install-once guard and only add an in-render
  `setFooter(undefined)` restore if reload does NOT re-instantiate (§6.4).
- **Don't fabricate the thinking-level indicator** — extensions can't read live
  interactive thinking state. Omit it and document the difference.
- **Keep pure logic out of the component.** `formatTokens`, cache-cluster string,
  bar math, window selection, provider mapping → standalone functions with unit
  tests; the component only does data-gathering + width/dim layout.
```
