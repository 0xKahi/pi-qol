## Why

Users often want a consistent reasoning/thinking level applied automatically whenever they pick a model through `/select-model`, instead of manually cycling the thinking level after every switch. Some models only support a subset of reasoning levels (or none at all), so this default must be applied only when the chosen model actually supports it, otherwise pi's own model-switch behavior should be left untouched.

## What Changes

- Add an optional `model_select.default_reasoning` config field (reuses the existing `ReasoningLevel` enum: `off | minimal | low | medium | high | xhigh`).
- After a model is applied via `pi.setModel` (both the interactive picker path and the exact-match `provider/modelId` shortcut), if `default_reasoning` is configured and the newly selected model supports that exact level, apply it via `pi.setThinkingLevel`.
- If the configured level is not supported by the selected model, skip applying it silently — leave whatever thinking level `pi.setModel` already established for that model in place (no clamping to a nearby level, no notification).
- Display the configured `default_reasoning` value in the model-select dialog's title bar (e.g. `reasoning: high`) when it is set; omit it entirely when unset. This is a static label reflecting configuration only, not a per-model prediction of whether it will apply.

## Capabilities

### New Capabilities
- `model-select-default-reasoning`: Configuration, apply-time behavior, and dialog display for a global default reasoning level applied on model selection.

### Modified Capabilities
(none — existing model-select-groups behavior is unaffected)

## Impact

- `src/schemas/model-select.config.schema.ts`: add optional `default_reasoning` field to `ModelSelectConfigSchema` and `PartialModelSelectConfigSchema`.
- `src/extensions/model-select/index.ts`: extend `applySelectedModel` to conditionally call `pi.setThinkingLevel` after a successful `pi.setModel`.
- `src/extensions/model-select/model-select-dialog.ts` and `types.ts`: thread `defaultReasoning` into `DialogOptions` and render it in the title bar.
- New dependency on `getSupportedThinkingLevels` from `@earendil-works/pi-ai` to determine per-model support before applying.
- No changes to favourite configuration shape (favourites continue to omit `reasoning`).
