## 1. Configuration Contract

- [x] 1.1 Extend the full and partial custom-footer Zod schemas with `display.agentName`, `colors.agentName`, and `defaultAgentName`, including defaults, trimming, non-empty validation, and existing `#RRGGBB` validation; verify focused config-schema tests pass.
- [x] 1.2 Expand custom-footer config tests to cover omitted defaults, accepted values, partial overrides, empty normalized defaults, and invalid colors; verify `bun test test/custom-footer/config-schema.test.ts` passes.

## 2. Agent Identity State and Event Contract

- [x] 2.1 Add the canonical `pi.qol.event:set-agent-name` event id plus a custom-footer state/normalization helper for unknown payload validation, ANSI/control sanitization, trimming, ten-visible-column truncation, and color fallback state; verify focused unit tests cover valid, malformed, empty, colored, colorless, and over-width inputs.
- [x] 2.2 Wire the event listener and session-start reset into custom-footer registration, with component change notifications requesting a render and disposal removing component subscriptions; verify tests demonstrate updates, ignored invalid names, non-sticky invalid/missing colors, render requests, and per-session reset.

## 3. Footer Rendering

- [x] 3.1 Prefix the first footer line with the inverse-styled agent badge and one normal separator when enabled, using event color, configured `colors.agentName`, or Pi theme `accent` in precedence order; verify ANSI-enabled rendering tests assert inverse/custom-color sequences and unchanged visible text.
- [x] 3.2 Cover disabled rendering, default-name rendering, no-bracket output, `VERY-LONG-...` truncation, Unicode terminal-width handling, sanitization, and narrow whole-line truncation; verify `bun test test/custom-footer/footer-component.test.ts` passes and existing path-line expectations remain unchanged when disabled.
- [x] 3.3 Render the agent badge with bold and inverse styling plus one styled padding space on each side, remove the separate normal separator before the directory, update README behavior documentation and focused rendering tests, and verify `bun test test/custom-footer/footer-component.test.ts` and `bun run check` pass.
- [x] 3.4 Add one normal, unstyled separator space between the padded agent badge and directory, reconcile documentation and rendering tests, and verify focused tests and repository checks pass.

## 4. Published Schema and Documentation

- [x] 4.1 Regenerate `assets/config.schema.json` from the canonical Zod schema and verify `bun run buildSchema` succeeds with the three new configuration fields and defaults present.
- [x] 4.2 Update `README.md` with the first-line badge behavior, configuration options, color precedence, ten-column truncation rule, reset semantics, and a valid `pi.events.emit('pi.qol.event:set-agent-name', ...)` example; verify documented keys and event id match the generated schema and exported constant.

## 5. Integration Verification

- [x] 5.1 Run the complete custom-footer test directory and resolve regressions; verify `bun test test/custom-footer` passes.
- [x] 5.2 Run repository-wide formatting/linting, type checking, and tests; verify `bun run check` and `bun test` pass without modifying behavior outside the planned footer capability.
