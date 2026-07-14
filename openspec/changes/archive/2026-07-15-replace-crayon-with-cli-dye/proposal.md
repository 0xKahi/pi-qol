## Why

The custom footer maintains a local ANSI styling utility that duplicates functionality now provided by the newly added `@0xkahi/cli-dye` dependency. Consolidating on the package removes bespoke escape-code handling and makes terminal styling behavior reusable and maintained in one place.

## What Changes

- Replace custom-footer calls to `crayon.colorize` with `@0xkahi/cli-dye` color builders using validated configured hex colors.
- Replace test-only ANSI stripping through `crayon.stripAnsi` with `dye.strip`.
- Remove `src/utils/crayon.util.ts` after all consumers migrate.
- Preserve the footer's visible text, configured truecolor output, theme fallbacks, truncation behavior, and subscription usage formatting.
- Add or adjust tests to cover cli-dye-backed styling and plain-text output.

## Capabilities

### New Capabilities
- `custom-footer-terminal-styling`: Defines how configured hex colors are applied to custom-footer content while preserving readable text and existing fallback behavior.

### Modified Capabilities

None.

## Impact

- Affected runtime code: `src/extensions/custom-footer/footer-component.ts` and `src/extensions/custom-footer/token-stats.ts`.
- Removed utility: `src/utils/crayon.util.ts` and its internal ANSI conversion/stripping implementation.
- Affected tests: custom-footer tests that currently import or assert through `crayon`.
- Dependency usage: the already-added `@0xkahi/cli-dye` runtime dependency becomes the single custom truecolor/ANSI stripping implementation for this feature.
- No configuration schema or public extension API changes are expected.
