# src/utils/

## Responsibility

This folder contains low-level, reusable helpers used across the `pi-qol` extension. They are pure utility modules with no business logic or UI concerns.

- **`crayon.util.ts`** — ANSI terminal styling: colorize text with hex foreground/background colors, apply reverse video, and strip ANSI escape sequences.
- **`model-resolver.util.ts`** — Resolve a concrete AI model and its authentication credentials from a configured `ModelConfig` or the active session model.
- **`raw-data-parser.util.ts`** — Type-safe coercion helpers for `unknown` runtime values into `Record<string, unknown>`, trimmed `string`, or finite `number`.
- **`path.util.ts`** — Locate extension-specific files on disk: generic file existence checks, global/project extension `config.json`, and the shared `auth.json` file.

## Design Patterns

- **Static utility classes** (`RawDataParser`, `PathUtil`) group related stateless functions under a clear namespace.
- **Service class with injected context** (`ModelResolver`) receives an `ExtensionContext` dependency rather than importing global state, keeping it testable and decoupled.
- **Object-as-namespace export** (`crayon`) exposes a small, discoverable API surface while hiding internal helpers (`hexToRgb`, `fgAnsi`, `bgAnsi`, `ANSI_ESCAPE_REGEX`).
- **Result/Option types** (`ResolveModelResult`, `FileSearchResult`) avoid exceptions and force callers to handle success and failure paths explicitly.
- **Function overloads** (`PathUtil.findExtensionConfig`) provide type-safe, domain-driven entry points for global vs. project lookups.
- **Defensive validation** (`RawDataParser`, `crayon.colorize`) silently returns `undefined` or the original input when data is invalid instead of throwing.

## Data & Control Flow

1. **Terminal styling**
   - `crayon.colorize(text, { fg?, bg? })` validates hex strings against `COLOR_HEX_REGEX`.
   - Valid colors are converted to RGB and wrapped in ANSI escape codes; the text is returned unchanged if no valid colors are provided.
   - `crayon.stripAnsi(text)` removes all ANSI escape sequences using a compiled regex.

2. **Model resolution**
   - `ModelResolver.resolveModel(configModel?)` builds a candidate list in priority order: configured model first, then the active session model (deduplicated).
   - For each candidate it calls `ctx.modelRegistry.getApiKeyAndHeaders(model)`.
   - The first candidate with successful auth is returned as a `ResolvedModel`, including the API key, headers, reasoning settings, and OAuth flag.
   - If all candidates fail, a consolidated error string is returned.

3. **Raw data parsing**
   - `RawDataParser.asRecord` checks for non-null, non-array objects.
   - `stringValue` returns only non-empty trimmed strings.
   - `numberValue` coerces strings/numbers and returns only finite values.

4. **Path resolution**
   - `PathUtil.findFile` checks `existsSync` and returns both existence and the resolved path.
   - `findExtensionConfig({ type: 'global' })` resolves to `<agentDir>/extensions/<EXTENSION_ID>/config.json`.
   - `findExtensionConfig({ type: 'project', cwd })` resolves to `<cwd>/.pi/extensions/<EXTENSION_ID>/config.json`.
   - `findPiAuthConfig` resolves to `<agentDir>/auth.json`.

## Integration Points

- `@earendil-works/pi-coding-agent`
  - `ExtensionContext` is injected into `ModelResolver` for model registry and session access.
  - `getAgentDir()` is used by `PathUtil` to resolve global and auth paths.
- `@earendil-works/pi-ai`
  - `Model<Api>` is the resolved entity returned by `ModelResolver`.
- `../constants`
  - `COLOR_HEX_REGEX` drives hex validation in `crayon`.
  - `EXTENSION_ID` is used by `PathUtil` to build config directory paths.
- `../schemas/shared-config.schema`
  - `ModelConfig` and its `reasoning` field are consumed by `ModelResolver`.
- `node:fs` / `node:path`
  - `PathUtil` relies on Node built-ins for synchronous file existence and cross-platform path joining.
