# src/schemas/

## Responsibility

This directory defines the Zod-based configuration schemas for the pi-qol plugin. It is the single source of truth for the shape, defaults, and validation rules of user-facing configuration. It covers the top-level config object and per-feature schemas for `auto-session-name`, `model-select` (including favourites, groups, tab visibility, provider filtering, and layout), and `custom-footer`, plus reusable shared schema building blocks.

## Design Patterns

- **Schema-first configuration**: Uses Zod to declare schemas and derive TypeScript types via `z.infer`.
- **Composition over monolith**: Per-feature schemas (`auto-session-name.config.schema.ts`, `model-select.config.schema.ts`, `custom-footer-config.schema.ts`) are composed into the top-level `ConfigSchema` in `config.schema.ts`.
- **Defaults embedded in schemas**: `.default()` is used heavily so schemas are self-describing and can parse incomplete inputs safely.
- **Full vs. Partial schemas**: Each feature exposes a full schema and a `Partial*` variant to support partial/merging updates (e.g., user overrides layered over defaults); model-select's explicit partial schema avoids materializing defaults before precedence merging.
- **Shared primitives**: `shared-config.schema.ts` centralizes reusable concepts like `ModelConfigSchema`, `ColorHexSchema`, and `ReasoningLevelSchema`.
- **Default object parsing**: `custom-footer-config.schema.ts` uses `Schema.parse({})` to derive concrete default objects rather than hand-writing inline literals.

## Data & Control Flow

1. **Input**: Raw JSON/user config enters the system.
2. **Validation**: The top-level `ConfigSchema.parse()` validates the whole object, falling back to per-field defaults for missing keys.
3. **Feature decomposition**: `ConfigSchema` delegates validation of each feature section to its dedicated schema (`AutoSessionNameConfigSchema`, `ModelSelectConfigSchema`, `CustomFooterConfigSchema`), which in turn use shared schemas (`ModelConfigSchema`, `ColorHexSchema`, `ReasoningLevelSchema`). `ModelSelectConfigSchema` also defines a `ModelSelectLayoutSchema` enum (`inline`/`overlay`) and `FavouriteModelSchema`, which omits `reasoning` from `ModelConfigSchema` and adds a `groups` array.
4. **Partial updates**: `PartialConfigSchema` and its feature-level partial variants allow validating incremental config changes without requiring a complete config object.
5. **Output**: Validated `Config` and `PartialConfig` types are exported for use by config loading, merging, and runtime feature code elsewhere in the plugin.

## Integration Points

- **Config loading / merging layer**: `config.schema.ts` exports `Config` and `PartialConfig` types consumed by whatever loads and merges user config with defaults.
- **Feature modules**: Auto-session-name, model-select, and custom-footer runtime code import their respective config types from this directory.
- **Constants**: `shared-config.schema.ts` imports `COLOR_HEX_REGEX` from `../constants` to validate hex colors.
- **Type system**: All schemas feed TypeScript types via `z.infer`, providing compile-time guarantees across the plugin.
