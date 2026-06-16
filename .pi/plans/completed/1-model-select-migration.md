# Plan: migrate `pi-model-select` into `pi-qol` as the `model_select` extension

> Port the standalone `pi-model-select` plugin
> (`/Users/kahi/Desktop/code/plugins/pi/pi-model-select`) into this repo as a
> self-contained extension under `src/extensions/model-select/`, wired into the
> shared `pi-qol` config + lifecycle conventions — the same way
> `auto-session-name` is structured.
>
> **Do not copy the plugin verbatim.** The standalone plugin ships its own config
> loader, jsonc parser, and `EXTENSION_ID`. In `pi-qol` those concerns are already
> solved by shared infra. Reuse the shared pieces and only keep the
> extension-specific code (the TUI dialog, model formatting, selection logic).

This document is written for an implementing agent. Read it top to bottom before
writing code.

---

## 0. Context you must internalize first

### 0.1 The two codebases

**Source plugin** `/Users/kahi/Desktop/code/plugins/pi/pi-model-select/src/`:
```
index.ts                 # factory: registerCommand('select-model') + event-bus handler
config-loader.ts         # OWN global/project loader w/ jsonc + warnings  ← DO NOT PORT
types.ts                 # ModelRef, Layout, ModelItem, DialogOptions, etc.
constants.ts             # EXTENSION_ID, COMMAND_NAME, PI_VIM_KEY_EVENT_ID, MAX_* tunables
model-select-dialog.ts   # TUI Component/Focusable picker (the real UI)
utils/model-formatter.ts # ModelFormatter (sort/describe/label/toModelItem)
utils/jsonc.ts           # JSONC parser                                    ← DO NOT PORT
```

**Target repo** `pi-qol` (this worktree) conventions (mirror `auto-session-name`):
- `src/index.ts` — thin default-export factory. Owns lifecycle wiring only:
  instantiates one shared `ConfigLoader`, loads config on `session_start`, then
  calls each extension's `register*(pi, { config })`.
- `src/config-loader.ts` — **central, multi-extension** zod-based loader. Holds
  in-memory `Config`, exposes `isEnabled(key)` + per-extension getters, merges
  global (`getAgentDir()`) then project (`cwd/.pi`, gated on `isProjectTrusted()`)
  config files, validates with zod and surfaces errors via `z.prettifyError`.
- `src/utils/path.util.ts` — `PathUtil.findExtensionConfig({type})` resolves
  `.../extensions/pi-qol/config.json`.
- `src/utils/model-resolver.util.ts` — `ModelResolver` (config-model → session-model
  fallback + auth via `modelRegistry.getApiKeyAndHeaders`).
- `src/constants.ts` — `EXTENSION_ID = 'pi-qol'` only.
- `src/schemas/*.schema.ts` — zod v4 schemas, full + `Partial` variants, composed
  into `config.schema.ts`.
- `scripts/build-schema.ts` + `build-schema-document.ts` — regenerate
  `assets/config.schema.json` from `ConfigSchema` via `bun run buildSchema`.
- `src/extensions/<name>/` — fully self-contained extension. `register<Name>(pi,
  { config })` installs `pi.on(...)` handlers and **self-guards on
  `config.isEnabled('<name>')` at event time** (so `/reload` + per-project toggles
  work without re-wiring).
- `test/<name>/*.test.ts` — pure `bun test` unit tests.
- Style: zod v4, single quotes, `arrowParentheses: asNeeded`, lineWidth 150,
  organizeImports. Run `bun run check` (biome fix + tsc) + `bun test` before done.

### 0.2 Current `model-select` state in this repo
- `src/extensions/model-select/index.ts` — **empty**, must be authored.
- Nothing else exists yet for this extension.

---

## 1. Reuse analysis (what shared infra replaces)

| Source plugin file / concern | In `pi-qol` → action |
|---|---|
| `config-loader.ts` (global/project merge, warnings) | **DROP.** Replaced by central `src/config-loader.ts`. Config now lives as a `model_select` section in the shared zod `ConfigSchema`. |
| `utils/jsonc.ts` | **DROP.** Central loader uses `JSON.parse`. No JSONC support in pi-qol. |
| `constants.ts` `EXTENSION_ID = 'pi-model-select'` | **DROP** the id. Use shared `EXTENSION_ID = 'pi-qol'` from `src/constants.ts` (config path is now shared). Keep the **tunables** in the extension's own `constants.ts`. |
| `types.ts` `LoadedConfig`, `warnings`, `hasFavouriteSection` | **REWORK.** Validation errors now come from zod (surfaced at `session_start`), not per-load `warnings`. `hasFavouriteSection` becomes a derived boolean (`favourite.length > 0`) computed at register/build time. |
| `index.ts` factory | **REWORK** into `registerModelSelect(pi, { config })` with self-guard on `config.isEnabled('model_select')`. |
| `model-select-dialog.ts` | **KEEP** (extension-specific TUI). Only adjust its `DialogOptions` input to drop config `warnings` (or feed only the modelRegistry error). |
| `utils/model-formatter.ts` | **KEEP** as `src/extensions/model-select/model-formatter.ts` (extension-specific). |
| Auth check `modelRegistry.hasConfiguredAuth(model)` / `find()` | **REUSE pi SDK directly** (same calls `auto-session-name` uses). `ModelResolver` util is a partial fit only for the "exact provider/modelId arg" path — see §4.4; not required to use it. |
| `src/utils/path.util.ts` | **REUSE** (already resolves the shared config path). No change. |
| `scripts/build-schema*.ts` | **REUSE.** Just re-run after adding the schema. |

> Net effect: roughly half the plugin (config loader + jsonc + warnings plumbing)
> disappears, absorbed by shared infra. The TUI dialog, model formatter, and
> selection logic are the real payload to port.

---

## 2. Files to create / edit

```
src/
  schemas/
    model-select.config.schema.ts       # (author) zod schema for model_select section
    config.schema.ts                    # (edit)   add model_select to Config + PartialConfig
  config-loader.ts                      # (edit)   add getModelSelect() getter
  index.ts                              # (edit)   call registerModelSelect(pi, { config })
  extensions/
    model-select/
      index.ts                          # (author) registerModelSelect(pi, { config })
      constants.ts                      # (author) COMMAND_NAME, PI_VIM_KEY_EVENT_ID, MAX_* tunables
      types.ts                          # (author) ModelItem, ModelLists, DialogOptions, etc.
      model-formatter.ts                # (author) port utils/model-formatter.ts
      model-select-dialog.ts            # (author) port the TUI dialog (light edits)
      model-lists.ts                    # (author) buildModelLists + findExactModel helpers (from index.ts)
test/
  model-select/
    model-formatter.test.ts             # (author) sort/describe/format unit tests
    model-lists.test.ts                 # (author) favourite filtering / exact-match unit tests
assets/config.schema.json               # (generated) via bun run buildSchema
README.md                               # (edit, optional) document model_select config
```

> Keep everything extension-specific under `src/extensions/model-select/`. Shared
> infra stays at `src/` root.

---

## 3. Config schema — `model_select` section (with new `enabled`)

The config keys stay the same as the standalone plugin (`favourite`,
`provider_filter`, `layout`) **plus a new `enabled` toggle**.

### 3.1 `src/schemas/model-select.config.schema.ts` (author)
```ts
import z from 'zod';

export const FavouriteModelSchema = z.object({
  provider: z.string().min(1),
  modelId: z.string().min(1),
});
export type FavouriteModel = z.infer<typeof FavouriteModelSchema>;

export const LayoutSchema = z.enum(['inline', 'overlay']);
export type Layout = z.infer<typeof LayoutSchema>;

export const ModelSelectConfigSchema = z.object({
  enabled: z.boolean().default(false),
  favourite: z.array(FavouriteModelSchema).default([]),
  provider_filter: z.array(z.string().min(1)).default([]),
  layout: LayoutSchema.default('inline'),
});
export type ModelSelectConfig = z.infer<typeof ModelSelectConfigSchema>;

export const PartialModelSelectConfigSchema = ModelSelectConfigSchema.partial();
export type PartialModelSelectConfig = z.infer<typeof PartialModelSelectConfigSchema>;
```

Notes:
- The standalone schema accepted `favourite | favourites | favorite | favorites`
  and `modelId | model` aliases (see `config-loader.collectFavouriteValues` /
  `parseFavouriteArray`). **Decision: drop the aliases** — standardize on
  `favourite` + `modelId` to match the JSON schema the plugin already ships
  (`config.schema.json` only documents `favourite`/`modelId`). If you want to keep
  backward compat, add `.transform`/preprocess, but it is not required.
- `provider_filter` keeps the snake_case key (matches existing plugin + its schema).

### 3.2 `src/schemas/config.schema.ts` (edit)
Add the section to both schemas, defaulting to disabled:
```ts
import { ModelSelectConfigSchema, PartialModelSelectConfigSchema } from './model-select.config.schema';

export const ConfigSchema = z.object({
  $schema: z.string().optional(),
  auto_session_name: AutoSessionNameConfigSchema.default({ enabled: false }),
  model_select: ModelSelectConfigSchema.default({ enabled: false }),
});

export const PartialConfigSchema = z.object({
  $schema: z.string().optional(),
  auto_session_name: PartialAutoSessionNameConfigSchema.optional(),
  model_select: PartialModelSelectConfigSchema.optional(),
});
```

### 3.3 Merge-semantics caveat (READ THIS)
The central `ConfigLoader.mergeConfig` shallow-merges **per top-level section**
(`{ ...baseSection, ...partialSection }`). This differs from the standalone plugin:
- Standalone: `favourite` arrays from global + project were **concatenated &
  deduped**; `provider_filter`/`layout` used project-if-present-else-global.
- pi-qol: if a project config sets `model_select.favourite`, it **replaces** the
  global `favourite` array (other keys it omits keep the global/default value).

**Decision: accept replace semantics** (consistent with how `auto_session_name`
merges, simpler, predictable). Document it in the README. If product wants the old
concat-favourites behavior, add a custom array-merge for `model_select.favourite`
inside `mergeConfig` — but only if explicitly required.

### 3.4 `src/config-loader.ts` (edit)
Add a getter mirroring `getAutoSessionName()`:
```ts
getModelSelect(): Config['model_select'] {
  return this.config.model_select;
}
```
`isEnabled('model_select')` already works via the generic implementation
(checks `section.enabled`). No other loader changes needed.

### 3.5 Regenerate JSON schema
After editing schemas: `bun run buildSchema` → updates `assets/config.schema.json`
(picks up `model_select` automatically since it derives from `ConfigSchema`).

Example shared config (`<cwd>/.pi/extensions/pi-qol/config.json`):
```json
{
  "$schema": "https://raw.githubusercontent.com/0xKahi/pi-qol/main/assets/config.schema.json",
  "model_select": {
    "enabled": true,
    "layout": "overlay",
    "provider_filter": ["anthropic", "openai"],
    "favourite": [
      { "provider": "anthropic", "modelId": "claude-sonnet-4-5" }
    ]
  }
}
```

---

## 4. Porting the extension code

### 4.1 `src/extensions/model-select/constants.ts` (author)
Port the tunables, drop `EXTENSION_ID`:
```ts
export const COMMAND_NAME = 'select-model';
export const MAX_VISIBLE_MODELS = 10;
export const MAX_CONFIG_WARNING_LINES = 4;
// Cross-extension activation hook (e.g. pi-vim-keys emits this to open the picker).
// Keep stable; namespacing by the shared extension id is fine.
export const PI_VIM_KEY_EVENT_ID = 'pi.vimKeys.event:pi-qol';
```
> Confirm the event id contract: the standalone plugin used
> `pi.vimKeys.event:pi-model-select`. If `pi-vim-keys` (or any caller) emits a
> hard-coded id, keep that exact string instead of re-namespacing. Verify before
> changing — grep the vim-keys plugin for the emitted id.

### 4.2 `src/extensions/model-select/types.ts` (author)
Port `ModelRef` (or import `FavouriteModel` from the schema), `Layout` (import from
schema), `ModelItem`, `ModelLists`, `SelectionSection`, `DialogResult`,
`DialogOptions`. **Remove** the `LoadedConfig`/`warnings`/`hasFavouriteSection`
config types — those came from the dropped loader. `DialogOptions` keeps
`configWarnings: string[]` only if you still feed it the modelRegistry error
(see §4.5); otherwise drop it.

### 4.3 `src/extensions/model-select/model-formatter.ts` (author)
Port `utils/model-formatter.ts` verbatim. Only change the import path for
`ModelItem` (now `./types`). No logic changes.

### 4.4 `src/extensions/model-select/model-lists.ts` (author)
Extract the pure-ish helpers currently living in the plugin's `index.ts`:
- `buildModelLists(ctx, config)` — refresh registry, filter by `provider_filter`,
  sort, map to `ModelItem`; build favourite items + per-favourite warnings using
  `ctx.modelRegistry.find()` + `ctx.modelRegistry.hasConfiguredAuth()`.
- `findExactModel(ctx, args)` — parse `provider/modelId` or `provider modelId`.

`config` here is `Config['model_select']` (the zod-typed section). Note
`buildModelLists` returns `favouriteWarnings` (per-favourite resolution issues like
"not found"/"no configured auth") — that is runtime data about the live registry,
**not** config parse warnings, so it stays.

### 4.5 `src/extensions/model-select/model-select-dialog.ts` (author)
Port the dialog almost verbatim. Adjustments:
- Update import paths (`./constants`, `./types`, `./model-formatter`).
- `DialogOptions.configWarnings`: previously combined config-parse warnings +
  `modelRegistry.getError()`. Config-parse warnings no longer exist. **Decision:**
  feed only the live registry error, e.g.
  `configWarnings: ctx.modelRegistry.getError() ? ['models.json: ' + ctx.modelRegistry.getError()] : []`.
  Keep the `MAX_CONFIG_WARNING_LINES` rendering path (it also still renders
  `favouriteWarnings`). If you prefer, rename `configWarnings` → `registryWarnings`
  for clarity.
- `hasFavouriteSection`: pass `config.favourite.length > 0` from the caller.
- Everything else (keybindings, fuzzy search, inline/overlay rendering) is unchanged.

### 4.6 `src/extensions/model-select/index.ts` (author) — `registerModelSelect`
Mirror `registerAutoSessionName` structure. Lifecycle wiring + self-guard:
```ts
import type { ExtensionAPI, ExtensionContext } from '@earendil-works/pi-coding-agent';
import type { ConfigLoader } from '../../config-loader';
import { COMMAND_NAME, PI_VIM_KEY_EVENT_ID } from './constants';
// ...buildModelLists, findExactModel, ModelSelectDialog, ModelFormatter

export function registerModelSelect(pi: ExtensionAPI, deps: { config: ConfigLoader }) {
  let latestCtx: ExtensionContext | undefined;

  pi.on('session_start', (_event, ctx) => { latestCtx = ctx; });

  pi.registerCommand(COMMAND_NAME, {
    description: 'Select/search models with favourites and provider filtering',
    handler: async (args, ctx) => {
      latestCtx = ctx;
      if (!deps.config.isEnabled('model_select')) {
        ctx.ui.notify('(pi-qol) model_select is disabled', 'warning');
        return;
      }
      await showModelSelector(pi, args, ctx, deps.config);
    },
  });

  pi.events.on(PI_VIM_KEY_EVENT_ID, () => {
    const ctx = latestCtx;
    if (!ctx || !deps.config.isEnabled('model_select')) return;
    void showModelSelector(pi, '', ctx, deps.config).catch(err =>
      ctx.ui.notify(`Failed to open model selector: ${err instanceof Error ? err.message : String(err)}`, 'error'),
    );
  });
}
```
- `showModelSelector(pi, args, ctx, config)` ports the plugin's function:
  `waitForIdle` guard → `refresh()` → exact-match shortcut → `hasUI` guard →
  `config.getModelSelect()` → `buildModelLists` → `ctx.ui.custom(...)` with
  inline/overlay options → `applySelectedModel`.
- `applySelectedModel` unchanged (`pi.setModel` + notify).
- **Enabled decision lives inside the command/event handler** (not at registration),
  matching the repo rule so `/reload` + per-project toggles work.
- Notify prefix: use `(pi-qol) ...` style consistent with `auto-session-name`.

> Registering the `/select-model` command unconditionally is fine; the handler
> early-returns with a notice when disabled. (Alternative: skip `registerCommand`
> when disabled — but that breaks `/reload`-time toggling, so prefer the runtime
> guard.)

### 4.7 `src/index.ts` (edit)
```ts
import { registerModelSelect } from './extensions/model-select';
// ...
registerAutoSessionName(pi, { config });
registerModelSelect(pi, { config });
```

---

## 5. Dependencies
- `@earendil-works/pi-tui` is already a peer/dev dependency in this repo's
  `package.json` — the dialog's `Input`, `fuzzyFilter`, `truncateToWidth`,
  `visibleWidth`, `Component`, `Focusable`, `TUI` imports resolve. No new deps.
- `modelsAreEqual` from `@earendil-works/pi-ai` is available. No new deps.

---

## 6. Testing (`bun test`, pure, no live model calls)
Add `test/model-select/`:
- `model-formatter.test.ts`:
  - `formatTokenCount` (e.g. 999 → "999", 1500 → "1.5K", 2_000_000 → "2M").
  - `modelLabel` / `describeModel` (capabilities: thinking/images flags).
  - `sortModels` puts current model first, then provider/id alpha.
- `model-lists.test.ts` (fake `ctx.modelRegistry`):
  - `findExactModel` parses `provider/modelId` and `provider modelId`, returns
    `undefined` for blank/partial.
  - `buildModelLists` filters by `provider_filter`, dedupes favourites, and emits
    `favouriteWarnings` for not-found / no-auth favourites (stub `find` +
    `hasConfiguredAuth`).
> The TUI dialog rendering is hard to unit test; rely on manual verification (§7).
> Factor `buildModelLists`/`findExactModel` as standalone functions (not methods on
> the dialog) so they're trivially testable with a fake ctx.

---

## 7. Manual verification
1. `bun run check` (biome + tsc) clean.
2. `bun test` green.
3. `bun run buildSchema` updates `assets/config.schema.json`; confirm `model_select`
   appears with `enabled`, `favourite`, `provider_filter`, `layout`.
4. Live with `model_select.enabled: true`:
   - `/select-model` opens the picker; favourites tab present when favourites
     configured; search fuzzy-filters; provider filter respected.
   - `inline` vs `overlay` layout both render.
   - `/select-model anthropic/claude-sonnet-4-5` selects directly (exact-match path).
   - Selecting applies model + notifies; non-authed model notifies error.
   - Cross-extension open via the `PI_VIM_KEY_EVENT_ID` event (if vim-keys wired).
5. Negative: `model_select.enabled: false` ⇒ `/select-model` notifies disabled and
   does nothing; event-bus open is a no-op.
6. Headless (`!ctx.hasUI`) ⇒ picker notifies it needs interactive UI; exact-match
   arg still works.

---

## 8. Build checklist
- [ ] `src/schemas/model-select.config.schema.ts` (enabled + favourite + provider_filter + layout)
- [ ] `src/schemas/config.schema.ts` adds `model_select` to full + Partial
- [ ] `src/config-loader.ts` adds `getModelSelect()`
- [ ] `src/extensions/model-select/constants.ts` (no EXTENSION_ID; tunables + event id confirmed)
- [ ] `src/extensions/model-select/types.ts` (drop loader/warnings types)
- [ ] `src/extensions/model-select/model-formatter.ts` (ported)
- [ ] `src/extensions/model-select/model-lists.ts` (buildModelLists + findExactModel)
- [ ] `src/extensions/model-select/model-select-dialog.ts` (ported; configWarnings reworked)
- [ ] `src/extensions/model-select/index.ts` (`registerModelSelect`, runtime enabled-guard)
- [ ] `src/index.ts` calls `registerModelSelect(pi, { config })`
- [ ] DROP: standalone config-loader, jsonc, EXTENSION_ID — not ported
- [ ] tests: `model-formatter` + `model-lists`
- [ ] `bun run buildSchema`, `bun run check`, `bun test` all pass
- [ ] README documents `model_select` config + merge (replace) semantics

---

## 9. Pitfalls / gotchas
- **Don't port the standalone `config-loader.ts` / `jsonc.ts`.** The shared loader
  + plain `JSON.parse` replace them. Porting them creates two competing config
  systems.
- **`EXTENSION_ID` is now `pi-qol`** (shared). The config path moved from
  `extensions/pi-model-select/config.json` to `extensions/pi-qol/config.json`.
  This is a breaking change for existing standalone users — note it in the README.
- **Merge semantics changed** (concat+dedupe favourites → replace). See §3.3.
- **Enabled-guard at event time**, never at registration — preserves `/reload`
  + per-project toggling.
- **`waitForIdle` only exists on command contexts.** Keep the
  `'waitForIdle' in ctx` runtime check when opening from the event bus (plain
  `ExtensionContext`).
- **`favouriteWarnings` ≠ config warnings.** Favourite warnings are live-registry
  resolution results and must stay; config-parse warnings are gone (zod handles
  validation at load time).
- **Confirm the cross-extension event id** against the actual emitter before
  renaming it (§4.1).
- **Dropping favourite/modelId aliases** is a behavior change; only keep aliases if
  you find existing user configs relying on them.
