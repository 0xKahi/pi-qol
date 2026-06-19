# Repository Atlas: pi-qol

## Project Responsibility

`pi-qol` is a Pi Coding Agent extension package that adds quality-of-life features to the host runtime: automatic session naming, interactive model selection, and a custom terminal footer with richer status and usage information.

The package is distributed as `@0xkahi/pi-qol`; its published payload is the source tree plus `assets/config.schema.json`. Runtime behaviour is controlled by Zod-validated configuration loaded from global and project-level Pi config files.

## System Entry Points

- `package.json`: package metadata, Pi extension registration (`pi.extensions: ["./src/index.ts"]`), scripts, peer dependencies, and publish payload.
- `src/index.ts`: runtime plugin entry point; creates the shared `ConfigLoader`, initializes config on `session_start`, and registers all feature modules.
- `src/config-loader.ts`: configuration loading and validation pipeline for default/global/project overrides.
- `src/extensions/*/index.ts`: feature registration functions for auto session naming, model selection, and custom footer rendering.
- `scripts/build-schema.ts`: Bun build script that generates `assets/config.schema.json` from the canonical Zod config schema.
- `assets/config.schema.json`: generated JSON Schema for editor/user-facing configuration validation.

## Root-Level Files

- `biome.json`: lint/format configuration used by `bun run lint` and `bun run check`.
- `tsconfig.json`: TypeScript compiler configuration used by `bun run type-check`.
- `bun.lock`: Bun dependency lockfile.
- `README.md` / `CHANGELOG.md`: user documentation and release history; excluded from generated codemap state.
- `.changeset/`: release/versioning metadata; excluded from codemap state.
- `test/`: Bun test suites for feature logic; excluded from codemap state by design.

## Directory Map

| Directory | Responsibility Summary | Detailed Map |
| --- | --- | --- |
| `src/` | Top-level runtime source for the Pi extension; bootstraps config and registers all feature modules plus shared concerns. | [View Map](src/codemap.md) |
| `src/extensions/` | Feature-level registration layer for auto session naming, model selection, and custom footer integration with Pi lifecycle events and UI hooks. | [View Map](src/extensions/codemap.md) |
| `src/extensions/auto-session-name/` | Generates and applies concise session titles from the first user message using guarded, abortable model calls. | [View Map](src/extensions/auto-session-name/codemap.md) |
| `src/extensions/model-select/` | Provides `/select-model` and event-driven interactive model picking with favourites, fuzzy search, and provider filtering. | [View Map](src/extensions/model-select/codemap.md) |
| `src/extensions/custom-footer/` | Replaces the default TUI footer with a status component for cwd/branch/session/model, token/cost/context, and subscription usage. | [View Map](src/extensions/custom-footer/codemap.md) |
| `src/libs/` | Shared domain libraries; currently provider-agnostic subscription usage access for UI consumers. | [View Map](src/libs/codemap.md) |
| `src/libs/subscription-usage/` | Fetches and normalizes AI-provider subscription/rate-limit usage behind a common facade. | [View Map](src/libs/subscription-usage/codemap.md) |
| `src/libs/subscription-usage/strategy/` | Provider-specific Strategy implementations for Anthropic OAuth and OpenAI Codex usage APIs. | [View Map](src/libs/subscription-usage/strategy/codemap.md) |
| `src/schemas/` | Zod-based single source of truth for config validation, defaults, partial override shapes, and exported config types. | [View Map](src/schemas/codemap.md) |
| `src/utils/` | Low-level shared helpers for ANSI styling, model/auth resolution, raw JSON coercion, and Pi path lookup. | [View Map](src/utils/codemap.md) |
| `scripts/` | Bun maintenance scripts for generating the JSON Schema asset from the source Zod schema. | [View Map](scripts/codemap.md) |
| `assets/` | Static generated artifacts, primarily the draft-07 JSON Schema consumed by editors and config tooling. | [View Map](assets/codemap.md) |

## Cross-Cutting Design Patterns

- **Pi plugin registration**: `src/index.ts` wires feature factories into the `ExtensionAPI`; features are activated by host lifecycle events rather than direct imports from the root.
- **Configuration layering**: defaults, global config, and trusted project config are merged and validated through Zod schemas before feature code reads them.
- **Feature isolation**: each extension owns its registration, state, helpers, and UI behaviour while sharing common config/model/path utilities.
- **Event-driven UI integration**: features listen to `session_start`, `session_shutdown`, `before_agent_start`, slash commands, and a cross-extension event id for model picker activation.
- **Strategy and facade for provider APIs**: subscription usage uses provider-specific strategies behind a normalized `SubscriptionUsageApi` so the footer consumes one common rate-window model.

## Data & Control Flow

1. Pi loads `@0xkahi/pi-qol` through the `package.json` extension entry `./src/index.ts`.
2. The default export creates one `ConfigLoader` and registers a `session_start` handler.
3. On each session start, config is loaded from Pi-global and trusted project locations, shallow-merged by feature section, validated by `ConfigSchema`, and surfaced to the UI if invalid.
4. `registerAutoSessionName`, `registerModelSelect`, and `registerCustomFooter` attach their own lifecycle, command, event, and UI handlers.
5. Runtime feature code reads config through `ConfigLoader`, uses shared utilities for model/auth/path/data parsing, and calls Pi host APIs for session naming, model switching, notifications, and footer rendering.
6. Build-time schema generation flows from `src/schemas/config.schema.ts` through `scripts/build-schema.ts` into `assets/config.schema.json`.

## Integration Points

- **Pi host runtime**: `@earendil-works/pi-coding-agent` supplies `ExtensionAPI`, `ExtensionContext`, lifecycle events, command registration, session naming, model switching, UI notifications, and footer replacement.
- **AI model layer**: `@earendil-works/pi-ai` supplies model types, model equality helpers, and `completeSimple` for title generation.
- **Terminal UI layer**: `@earendil-works/pi-tui` supplies component/focus contracts, input routing, themes, width helpers, and fuzzy filtering.
- **Validation/tooling**: `zod` defines runtime schemas and generates JSON Schema for external consumers.
- **Filesystem**: config and auth are read from Pi agent directories and optionally from project `.pi/extensions/pi-qol/config.json` when trusted.
- **External provider APIs**: custom footer subscription usage can query Anthropic OAuth and OpenAI Codex usage endpoints when local OAuth auth is available.
