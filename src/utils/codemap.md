# src/utils/

## Responsibility

This folder contains low-level, reusable helpers used across the `pi-qol` extension. They are pure utility modules with no business logic or UI concerns.

- **`model-resolver.util.ts`** — Resolve a concrete AI model and its authentication credentials from a configured `ModelConfig` or the active session model.
- **`raw-data-parser.util.ts`** — Type-safe coercion helpers for `unknown` runtime values into `Record<string, unknown>`, trimmed `string`, or finite `number`.
- **`path.util.ts`** — Resolve extension-specific paths on disk: shell-style variable expansion (`~`, `$HOME`, `$VAR`), generic file existence checks, global/project extension `config.json`, and the shared `auth.json` file.

## Design Patterns

- **Static utility classes** (`RawDataParser`, `PathUtil`) group related stateless functions under a clear namespace.
- **Service class with injected context** (`ModelResolver`) receives an `ExtensionContext` dependency rather than importing global state, keeping it testable and decoupled.
- **Result/Option types** (`ResolveModelResult`, `FileSearchResult`) avoid exceptions and force callers to handle success and failure paths explicitly.
- **Function overloads** (`PathUtil.findExtensionConfig`) provide type-safe, domain-driven entry points for global vs. project lookups.
- **Defensive validation** (`RawDataParser`) silently returns `undefined` when data is invalid instead of throwing.

## Data & Control Flow

1. **Model resolution**
   - `ModelResolver.resolveModel(configModel?)` builds a candidate list in priority order: configured model first, then the active session model (deduplicated).
   - For each candidate it calls `ctx.modelRegistry.getApiKeyAndHeaders(model)`.
   - The first candidate with successful auth is returned as a `ResolvedModel`, including the API key, headers, reasoning settings, and OAuth flag.
   - If all candidates fail, a consolidated error string is returned.

2. **Raw data parsing**
   - `RawDataParser.asRecord` checks for non-null, non-array objects.
   - `stringValue` returns only non-empty trimmed strings.
   - `numberValue` coerces strings/numbers and returns only finite values.

3. **Path resolution**
   - `PathUtil.expandPath` replaces shell-style variables (`~`, `$HOME`, `$VAR`, `${VAR}`) and `~` with the user's home directory.
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
  - `EXTENSION_ID` is used by `PathUtil` to build config directory paths.
- `../schemas/shared-config.schema`
  - `ModelConfig` and its `reasoning` field are consumed by `ModelResolver`.
- `node:fs` / `node:path` / `node:os`
  - `PathUtil` relies on Node built-ins for synchronous file existence, cross-platform path joining, and shell-style variable expansion (`homedir`, `userInfo`).
