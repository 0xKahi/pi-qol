# src/schemas/

## Responsibility

This directory defines the Zod-based configuration schemas for the `pi-qol` plugin. It is the single source of truth for the shape, defaults, and validation rules of user-facing configuration. It covers the top-level config object and per-feature schemas for `auto-session-name`, `model-select`, `custom-footer`, and `context-view`, plus reusable shared primitives (`ModelConfig`, `ReasoningLevel`, `ColorHex`).

## Files

| File | Exports | Purpose |
| --- | --- | --- |
| `shared-config.schema.ts` | `ReasoningLevelSchema`, `ReasoningLevel`; `ModelConfigSchema`, `ModelConfig`; `ColorHexSchema` | Reusable primitives shared across feature schemas. |
| `auto-session-name.config.schema.ts` | `AutoSessionNameConfigSchema`, `AutoSessionNameConfig`; `PartialAutoSessionNameConfigSchema`, `PartialAutoSessionNameConfig` | Full and partial schemas for the session-naming feature. |
| `model-select.config.schema.ts` | `FavouriteModelSchema` (private); `ModelSelectLayoutSchema`, `ModelSelectLayout`; `HideTabsSchema` (private); `ModelSelectConfigSchema`, `ModelSelectConfig`; `PartialModelSelectConfigSchema`, `PartialModelSelectConfig` | Full and partial schemas for the model picker, including favourites, groups, tab visibility, provider filtering, layout, and default reasoning. |
| `custom-footer-config.schema.ts` | `CustomFooterConfigSchema`, `CustomFooterConfig`; `DEFAULT_CUSTOM_FOOTER_CONFIG`; `PartialCustomFooterConfigSchema`, `PartialCustomFooterConfig` | Full and partial schemas for the footer, including colors, icons, and display flags. |
| `context-view.config.schema.ts` | `ContextViewConfigSchema`, `ContextViewConfig`; `DEFAULT_CONTEXT_VIEW_CONFIG`; `PartialContextViewConfigSchema`, `PartialContextViewConfig` | Full and partial schemas for the context-view feature (disabled by default). |
| `config.schema.ts` | `ConfigSchema`, `Config`; `PartialConfigSchema`, `PartialConfig` | Top-level schema that composes all feature schemas and exports the canonical full and partial config types. |

## Schema Composition

- **Shared primitives**: `shared-config.schema.ts` defines the lowest-level building blocks.
  - `ReasoningLevelSchema` is a strict enum of `'off' | 'minimal' | 'low' | 'medium' | 'high' | 'xhigh'`.
  - `ModelConfigSchema` requires `{ provider, modelId, reasoning }`, where `reasoning` is `ReasoningLevelSchema`.
  - `ColorHexSchema` validates `#RRGGBB` hex strings using the `COLOR_HEX_REGEX` from `../constants`.
- **Per-feature schemas** are composed independently, then imported into the top-level `ConfigSchema` in `config.schema.ts`.
  - `AutoSessionNameConfigSchema` contains `enabled: boolean` and an optional `model: ModelConfigSchema`.
  - `ModelSelectConfigSchema` contains:
    - `enabled: boolean`
    - `favourite`: array of `FavouriteModelSchema`, which is `ModelConfigSchema.omit({ reasoning: true }).extend({ groups: string[] })`
    - `favourite_label: string` (non-empty, default `'Favourites'`)
    - `groups: string[]` (non-empty entries, default `[]`)
    - `hide_tabs: { groups: boolean, search: boolean }` (default `false` for both)
    - `provider_filter: string[]` (non-empty entries, default `[]`)
    - `default_reasoning: ReasoningLevelSchema` (optional, no default)
    - `layout: 'inline' | 'overlay'` (default `'inline'`)
  - `CustomFooterConfigSchema` contains:
    - `enabled: boolean`
    - `colors: { directory?, modelName?, anthropicUsage?: '#D97706', codexUsage?: '#10B981' }`
    - `icons: { directory?: '  ', refresh?: ' ', cache?: ' ', cacheRead?: ' ', cacheWrite?: ' ' }`
    - `display: { tokens?: true, cache?: true }`
  - `ContextViewConfigSchema` contains only `enabled: boolean`.
- **Top-level composition**: `ConfigSchema` is a `z.object({ $schema?, auto_session_name, model_select, custom_footer, context_view })` where each feature section is a full feature schema. `PartialConfigSchema` is a parallel object where every feature section is the corresponding partial schema and all keys are optional.

## Defaults & Partial Overrides

- **Defaults are embedded in schemas** via `.default()` so that `ConfigSchema.parse({})` materializes every missing value.
- **Per-feature defaults**:
  - `auto_session_name`: default object `{ enabled: false }` (model is omitted).
  - `model_select`: default object `{ enabled: false, favourite: [], favourite_label: 'Favourites', groups: [], hide_tabs: { groups: false, search: false }, provider_filter: [], layout: 'inline' }` (`default_reasoning` is omitted).
  - `custom_footer`: default object is derived by `CustomFooterConfigSchema.parse({ enabled: false })`, then re-exported as `DEFAULT_CUSTOM_FOOTER_CONFIG`. This yields all nested default colors, icons, and display flags.
  - `context_view`: default object is derived by `ContextViewConfigSchema.parse({})`, re-exported as `DEFAULT_CONTEXT_VIEW_CONFIG`.
- **Partial schemas** are designed for config-layer merging:
  - `PartialAutoSessionNameConfigSchema` is generated with `AutoSessionNameConfigSchema.partial()`.
  - `PartialModelSelectConfigSchema`, `PartialCustomFooterConfigSchema`, and `PartialContextViewConfigSchema` are hand-written to make every field optional, so user/project overrides only specify the keys they want to override.
  - `PartialConfigSchema` wraps all feature partial schemas as optional sections.
- **Merging semantics** (implemented in `src/config-loader.ts`):
  - Defaults are computed with `ConfigSchema.parse({})`.
  - Global config is validated with `PartialConfigSchema` and shallow-merged per feature section.
  - Project config is validated with `PartialConfigSchema` and shallow-merged only when the project is trusted.
  - For each feature section, if both the base value and the partial value are plain objects, the partial is spread over the base (`{ ...base, ...partial }`); arrays and primitives replace the base value entirely.
  - The final merged object is run through `ConfigSchema.parse()` to apply defaults and catch any invalid merged values.
  - `$schema` is ignored during merging.

## Inferred Types

All schemas derive TypeScript types via `z.infer`:

- `Config` from `ConfigSchema`
- `PartialConfig` from `PartialConfigSchema`
- `AutoSessionNameConfig` / `PartialAutoSessionNameConfig`
- `ModelSelectConfig` / `PartialModelSelectConfig`
- `CustomFooterConfig` / `PartialCustomFooterConfig`
- `ContextViewConfig` / `PartialContextViewConfig`
- `ModelConfig` from `ModelConfigSchema`
- `ReasoningLevel` from `ReasoningLevelSchema`
- `ModelSelectLayout` from `ModelSelectLayoutSchema`

Because the full schemas use `.default()`, a successfully parsed `Config` has every top-level feature section and every required field fully present. The partial types preserve optionality for layered overrides.

## Validation & Data Flow

1. **Input**: Raw JSON is loaded from global and project config files (`ConfigLoader` via `PathUtil`).
2. **Partial validation**: `PartialConfigSchema.safeParse(raw)` validates each config file independently. Invalid files surface a Zod error.
3. **Merge**: Valid partial configs are layered over the defaults using per-feature shallow object merging.
4. **Final validation**: `ConfigSchema.safeParse(merged)` ensures the merged result satisfies all constraints and fills in any remaining defaults. The validated `Config` is stored in the `ConfigLoader` instance.
5. **Runtime read**: Feature code reads the validated config through `ConfigLoader` getters (`getAutoSessionName`, `getModelSelect`, `getCustomFooter`, `getContextView`) and typed aliases (`Config['custom_footer']` in `src/extensions/custom-footer/types.ts`).
6. **Constraints**:
   - `favourite_label`, `groups`, and `provider_filter` entries must be non-empty strings.
   - `default_reasoning` must be one of the `ReasoningLevel` values when present.
   - `layout` must be `inline` or `overlay`.
   - Colors must be `#RRGGBB` hex strings.
   - `enabled` must be a boolean.

## Build & Runtime Consumers

- **Build-time JSON Schema generation**: `scripts/build-schema-document.ts` imports `ConfigSchema` and calls `z.toJSONSchema(ConfigSchema, { target: 'draft-7', unrepresentable: 'any', io: 'input' })`, then wraps it with draft-07 metadata (`$schema`, `$id`, title, description) to produce `assets/config.schema.json`. This generated file is the user-facing schema for editors and config validation tooling.
- **Runtime configuration loading**: `src/config-loader.ts` imports `ConfigSchema`, `PartialConfigSchema`, and their inferred types. It is the only runtime consumer that validates and merges configs.
- **Runtime feature consumers**:
  - `src/extensions/model-select/index.ts` uses `ModelSelectConfig`.
  - `src/extensions/model-select/types.ts` uses `ModelSelectLayout` and `ReasoningLevel`.
  - `src/extensions/custom-footer/types.ts` re-exports `Config['custom_footer']` as `CustomFooterConfig` and derives `colors`/`display`/`icons` sub-types.
  - `src/utils/model-resolver.util.ts` uses `ModelConfig` to resolve optional `{ provider, modelId, reasoning }` into runtime Pi models.
- **Tests**: `test/model-select/config-schema.test.ts`, `test/custom-footer/config-schema.test.ts`, `test/context-view/config-schema.test.ts`, and `test/model-select/default-reasoning.test.ts` exercise `ConfigSchema`, `PartialConfigSchema`, and `ModelSelectConfigSchema` to verify defaults, partial behavior, and validation errors.

## Integration Points

- **`src/config-loader.ts`**: uses the full and partial schemas to load, merge, and validate global and project configuration.
- **`src/index.ts`**: creates the `ConfigLoader` and registers features; features are activated by the validated config.
- **`scripts/build-schema-document.ts`**: generates the published JSON Schema from `ConfigSchema`.
- **`assets/config.schema.json`**: generated artifact consumed by editors and user-facing config tooling.
- **`src/constants.ts`**: supplies `COLOR_HEX_REGEX` to `ColorHexSchema`.
- **Type system**: all exported types are consumed by feature modules and shared utilities to provide compile-time guarantees across the plugin.
