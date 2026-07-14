## Context

The custom footer currently imports `crayon`, a local utility that validates `#RRGGBB` strings, converts them to RGB escape sequences, and strips ANSI sequences in tests. `@0xkahi/cli-dye` version 1.1.0 is now a runtime dependency and provides equivalent truecolor generation and ANSI stripping, plus environment-aware color enablement. Footer color values are already validated by the Zod configuration schema before rendering.

## Goals / Non-Goals

**Goals:**
- Make `@0xkahi/cli-dye` the custom footer's single implementation for custom truecolor styling and ANSI stripping.
- Preserve all visible footer content, color selection, theme fallbacks, width calculations, and truncation behavior.
- Remove the redundant local `crayon` utility and migrate tests to the package API.
- Verify styling deterministically without leaking cli-dye global state between tests.

**Non-Goals:**
- Changing the custom-footer color configuration format or accepting new color formats.
- Replacing Pi theme styling used for dim, warning, or error text.
- Restyling footer content or changing layout and subscription usage calculations.
- Changing cli-dye's automatic color-support policy globally at runtime.

## Decisions

### Convert validated configuration colors with `dye.hex`

Each configured custom color will be converted with `dye.hex(color)` and passed to `dye.colorize(text, { fg })`. This uses cli-dye's public truecolor API directly. The existing config schema guarantees six-digit hash-prefixed values, so rendering does not need a compatibility wrapper or duplicate regex validation.

An adapter that preserved the `crayon.colorize` signature was considered, but rejected because it would retain a redundant abstraction whose only remaining purpose would be forwarding calls.

### Import cli-dye directly at styling call sites

`footer-component.ts` and `token-stats.ts` will import `dye` directly. This makes the dependency and conversion explicit, keeps fallback branches unchanged, and allows `crayon.util.ts` to be deleted.

A shared footer styling helper was considered, but the small number of straightforward call sites does not justify another local wrapper.

### Respect cli-dye's resolved enabled state in production

Runtime code will not call `dye.setEnabled`. cli-dye will therefore follow its documented TTY and environment detection (`NO_COLOR`, `FORCE_COLOR`, and `TERM=dumb`). This is preferable to forcing ANSI output globally and gives users standard control over color output. When colors are disabled, cli-dye returns the same primitive plain text, so footer content and width calculations remain valid.

Tests that need to prove escape-code generation can temporarily enable dye and restore automatic detection in cleanup. Assertions concerned only with visible content will use `dye.strip`.

### Preserve schema validation and theme fallbacks

The existing `ColorHexSchema` remains the configuration boundary. Optional directory and model colors will retain their existing theme-based fallback when absent. Required provider usage colors will continue to color the same labels, progress bar section, and percentage.

## Risks / Trade-offs

- [cli-dye may suppress ANSI in non-color environments where crayon emitted it unconditionally] → Treat this as intentional standards-compliant behavior and test both styled and plain-text results.
- [`dye.hex` throws for invalid input] → Keep Zod color validation as the mandatory boundary and add regression coverage showing valid configured colors render correctly.
- [Tests can leak `dye.setEnabled` state through the module singleton] → Restore automatic detection with `dye.setEnabled(undefined)` in test cleanup and avoid parallel stateful assertions where necessary.
- [Removing `crayon` could miss a consumer] → Search source and tests for all imports before deletion, then run type-check, lint, and the full test suite.
