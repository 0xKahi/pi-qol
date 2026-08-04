# assets/

## Responsibility

The `assets/` directory contains published, generated artifacts consumed by the `pi-qol` extension and its consumers. Its only artifact is `config.schema.json`, a JSON Schema (draft-07) generated from the canonical Zod config schema in `src/schemas/config.schema.ts`. It is the user-facing definition of the extension configuration: available features, default values, accepted ranges, required fields, and enum constraints. Editors, IDEs, and the extension can reference it to validate and autocomplete `pi-qol` configuration.

## Generated-artifact Lifecycle

1. The canonical shape is defined in `src/schemas/config.schema.ts` and its subschemas (`src/schemas/*-config.schema.ts`).
2. `scripts/build-schema.ts` (entry point) is executed via `bun run buildSchema`.
3. It calls `createConfigJsonSchema()` from `scripts/build-schema-document.ts`.
4. `createConfigJsonSchema()` uses `z.toJSONSchema(ConfigSchema, { target: 'draft-7', unrepresentable: 'any', io: 'input' })` to convert the Zod schema into a JSON Schema object.
5. The generated schema is wrapped with metadata (`$schema`, `$id`, `title`, `description`).
6. `build-schema.ts` writes the formatted result to `assets/config.schema.json` via `Bun.write()`.
7. `assets/config.schema.json` is included in the published package via the `files` array in `package.json`.

The artifact must be regenerated after any change to the Zod schema source.

## Schema Contents / Config Sections

The schema defines four feature-flagged top-level sections, each wrapping related options in nested objects:

- `$schema`: Optional string referencing the schema URL/path.
- `auto_session_name`: Optional LLM-backed session naming.
  - `enabled`: Boolean toggle (default `false`).
  - `model`: Object with required `provider`, `modelId`, and `reasoning` enum (`off`, `minimal`, `low`, `medium`, `high`, `xhigh`).
- `model_select`: Custom model picker UI.
  - `enabled`: Boolean toggle (default `false`).
  - `favourite`: Array of favourite model objects with `provider`, `modelId`, and optional `groups` array.
  - `favourite_label`: Non-empty display label (default `"Favourites"`).
  - `groups`: Array of custom group names.
  - `hide_tabs`: Object with `groups` and `search` booleans (default `false`).
  - `provider_filter`: Array of allowed provider names.
  - `default_reasoning`: Optional reasoning-level default.
  - `layout`: Enum `inline` or `overlay` (default `inline`).
- `custom_footer`: Custom footer content.
  - `enabled`: Boolean toggle (default `false`).
  - `colors`: Hex color map (`directory`, `modelName`, `anthropicUsage`, `codexUsage`). `anthropicUsage` defaults to `#D97706`, `codexUsage` to `#10B981`.
  - `icons`: Glyph map for `directory`, `refresh`, `cache`, `cacheRead`, `cacheWrite` with default Unicode glyphs.
  - `display`: Object with `tokens` and `cache` booleans (default `true`).
- `context_view`: Additional context viewer feature.
  - `enabled`: Boolean toggle (default `false`).
  - `layout`: Enum `inline` or `overlay` (default `inline`), controlling normal versus centered bordered presentation.

Shared constraints:
- `reasoning` and `layout` are represented as JSON Schema `enum` values.
- Color properties use a `^#[0-9a-fA-F]{6}$` pattern.
- Non-empty string arrays use `minLength: 1`.
- All optional settings fall back to schema-level `default` values.

## Design Patterns

- **Schema-driven configuration**: A single canonical Zod schema is used for both runtime validation and generated JSON Schema documentation.
- **Feature flags**: Each top-level feature is wrapped in an `enabled` boolean so modules can be activated independently.
- **Nested option objects**: Related settings are grouped into sub-objects (`model`, `favourite`, `groups`, `hide_tabs`, `provider_filter`, `colors`, `icons`, `display`) to keep the schema hierarchical and self-documenting.
- **Enum-driven UX modes**: Discrete choices (`reasoning` levels, `layout` modes) use JSON Schema `enum` to prevent invalid values.
- **Hex color validation**: Footer color properties use a six-digit hex regex pattern.

## Data & Control Flow

1. The runtime config shape is defined in `src/schemas/config.schema.ts` and validated with Zod.
2. `bun run buildSchema` regenerates `assets/config.schema.json` from the canonical Zod schema.
3. The extension loads the user's configuration (e.g., an editor settings file or `pi-qol.json`).
4. The configuration is validated against `assets/config.schema.json`.
5. Based on each feature's `enabled` flag, individual feature modules are initialized.
6. Feature modules read their respective nested configuration objects (`model.*`, `favourite[]`, `favourite_label`, `groups`, `hide_tabs.*`, `provider_filter`, `default_reasoning`, `layout`, `colors.*`, `icons.*`, `display.*`) to drive behavior.
7. Optional settings fall back to the schema-defined `default` values when absent.

## Integration Points

- **Extension host / editor settings**: The schema is referenced by editor configurations (via the `$schema` URL or a local path) to provide autocomplete, validation, and tooltips.
- **Feature modules in `src/`**: Source code parses the validated configuration and maps each top-level property to a corresponding feature implementation.
- **Zod schema source**: `src/schemas/config.schema.ts` and its subschemas are the canonical source of truth; the generated schema must be regenerated with `bun run buildSchema` after any schema change.
- **NPM package artifact**: `assets/config.schema.json` is listed in `package.json` `files` and included in the published package so consumers can reference it locally or remotely.
- **Default value provider**: The schema's `default` fields are the canonical source of fallback values across the extension.
