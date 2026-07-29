## 1. Config schema

- [x] 1.1 Add optional `default_reasoning` field (using the existing `ReasoningLevelSchema`) to `ModelSelectConfigSchema` in `src/schemas/model-select.config.schema.ts`, with no default value.
- [x] 1.2 Add the corresponding optional `default_reasoning` field to `PartialModelSelectConfigSchema`.
- [x] 1.3 Regenerate `assets/config.schema.json` via the existing build-schema script and confirm the new field appears.

## 2. Apply-time behavior

- [x] 2.1 In `src/extensions/model-select/index.ts`, extend `applySelectedModel` to, after a successful `pi.setModel(model)`, read `config.default_reasoning` (threading the `ModelSelectConfig` into the function if not already available at that call site).
- [x] 2.2 When `default_reasoning` is configured, use `getSupportedThinkingLevels` from `@earendil-works/pi-ai` to compute the selected model's supported levels and check exact membership of the configured value.
- [x] 2.3 If the configured level is supported, call `pi.setThinkingLevel(level)`.
- [x] 2.4 If the configured level is not supported (including models with no reasoning support at all, unless the configured level is `off`), do nothing — no call to `setThinkingLevel`, no notification.
- [x] 2.5 Ensure this logic runs for both the interactive dialog selection path and the exact `provider/modelId` match shortcut, since both converge on `applySelectedModel`.
- [x] 2.6 Ensure no thinking-level change is attempted when `pi.setModel` reports failure (no configured auth).

## 3. Dialog display

- [x] 3.1 Add an optional `defaultReasoning` field to `DialogOptions` in `src/extensions/model-select/types.ts`.
- [x] 3.2 Pass `config.default_reasoning` through from `showModelSelector` in `index.ts` when constructing the `ModelSelectDialog`.
- [x] 3.3 In `model-select-dialog.ts`'s `renderTitle()`, append a `reasoning: <level>` segment when `defaultReasoning` is set, and omit it entirely when not set.

## 4. Tests

- [x] 4.1 Add unit tests covering: level supported → thinking level is set; level unsupported → thinking level is left untouched (no call made); model with no reasoning support and configured level is `off` → applied; `default_reasoning` unset → no thinking-level call at all.
- [x] 4.2 Add a test confirming the exact-match shortcut path applies the same default-reasoning behavior as the dialog path.
- [x] 4.3 Add a test confirming no thinking-level change is attempted when `setModel` fails.
- [x] 4.4 Add a test/assertion for the dialog title rendering with and without `defaultReasoning` configured.

## 5. Validation

- [x] 5.1 Run `bun run type-check`, `bun run lint`, and the test suite.
- [x] 5.2 Manually verify in an interactive session: configure `default_reasoning`, select a model that supports it (level applies), then select a model that doesn't (level from `setModel` is left unchanged, no notification shown).
