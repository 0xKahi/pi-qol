## 1. Migrate Custom Footer Styling

- [x] 1.1 Update `footer-component.ts` to import `dye`, convert validated directory/model hex colors with `dye.hex`, and preserve existing theme fallback branches.
- [x] 1.2 Update `token-stats.ts` to style provider labels, filled progress, and percentages through `dye.colorize` with the configured provider hex color.
- [x] 1.3 Remove `src/utils/crayon.util.ts` and update source documentation/codemaps so no runtime code references the local utility.

## 2. Update Regression Coverage

- [x] 2.1 Replace test imports and ANSI stripping calls from `crayon.stripAnsi` with `dye.strip`.
- [x] 2.2 Add deterministic coverage for configured cli-dye truecolor output and plain-text behavior, restoring cli-dye's automatic enabled state after stateful tests.
- [x] 2.3 Verify stripped directory, model, and subscription segments retain their existing visible text and fallback formatting.

## 3. Validate the Refactor

- [x] 3.1 Search source and tests to confirm no imports or calls to `crayon` remain.
- [x] 3.2 Run the custom-footer tests and full Bun test suite.
- [x] 3.3 Run repository lint/format and TypeScript type-check commands, resolving any migration issues.
