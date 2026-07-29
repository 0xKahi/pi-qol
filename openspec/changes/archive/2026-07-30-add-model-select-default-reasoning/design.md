## Context

Model selection currently funnels through a single `applySelectedModel` function in `src/extensions/model-select/index.ts`, used by both the interactive dialog and the exact-match `provider/modelId` shortcut. It calls `pi.setModel(model)` and reports success/failure; it does not touch thinking/reasoning level at all today. See proposal.md - Why for the motivation.

Two relevant primitives already exist in `@earendil-works/pi-ai`:
- `getSupportedThinkingLevels(model): ModelThinkingLevel[]` — returns the exact set of levels (including `"off"`) a model supports, based on `model.reasoning` and `model.thinkingLevelMap`.
- `clampThinkingLevel(model, level)` — snaps an unsupported level to the *nearest* supported one.

The `ExtensionAPI.setThinkingLevel(level)` method internally clamps any unsupported level to the nearest supported one (via the same clamping logic pi uses when switching models). It never rejects or no-ops on an unsupported level.

## Goals / Non-Goals

**Goals:**
- Apply a configured default reasoning level automatically after model selection, when the model supports it exactly.
- Preserve pi's own model-switch thinking-level behavior untouched when the configured level isn't supported by the newly selected model.
- Surface the configured value in the picker UI without adding per-model computation to the dialog.

**Non-Goals:**
- Per-favourite reasoning overrides (favourites continue to omit `reasoning`; this is a single global setting).
- Clamping to a nearby supported level when the exact configured level isn't available — that is explicitly rejected in favor of leaving pi's own choice alone.
- Any notification/warning UI when the configured level is skipped.
- Predicting, in the dialog, whether the configured level will apply to whichever model is currently highlighted.

## Decisions

**Decision: Pre-filter with `getSupportedThinkingLevels` before calling `setThinkingLevel`, rather than relying on `setThinkingLevel`'s built-in clamp.**
Rationale: `setThinkingLevel` always clamps to the nearest supported level rather than rejecting an unsupported request. Calling it unconditionally with the configured default would silently reinterpret "unsupported" as "clamp to nearest," which is exactly the behavior this feature must avoid (e.g. a max-only model must not get force-clamped up to its max when the config says `low` — it should just keep whatever `setModel` already set). The exact-membership check must happen in pi-qol code, not be delegated to the host API.
Alternative considered: call `setThinkingLevel` unconditionally and accept the clamp — rejected because it violates the explicit "skip silently, don't reinterpret" requirement.

**Decision: Apply order is `setModel` then conditionally `setThinkingLevel`, only after `setModel` succeeds.**
Rationale: `pi.setModel` already establishes a valid thinking level for the new model as part of its own switch logic — that result is "pi's original behavior" and is the correct fallback state to leave in place. Attempting to set thinking level before/without a successful model switch has no valid target model to check support against, and a failed `setModel` (e.g. missing auth) means no session state changed at all.

**Decision: Single choke point — extend `applySelectedModel`, not each call site.**
Rationale: both the dialog path and the exact-match shortcut already converge on `applySelectedModel`. Adding the conditional `setThinkingLevel` call there guarantees identical behavior regardless of how the model was chosen, with no duplicated logic.

**Decision: Dialog displays the configured value statically; no per-model support check in the UI.**
Rationale: computing "will this apply to the currently highlighted model" would require calling `getSupportedThinkingLevels` on every navigation and duplicating the same support logic used at apply time, for a question the user explicitly did not ask to have answered in the UI. A static label read directly from config avoids any coupling between dialog rendering and apply-time logic, and avoids re-deriving support state per keystroke.

**Decision: Reuse the existing `ReasoningLevel`/`ThinkingLevel` value space as-is, including `"off"`.**
Rationale: `ExtensionAPI.setThinkingLevel` types its parameter using the agent-core `ThinkingLevel`, which includes `"off"` (unlike the pi-ai package's own `ThinkingLevel`, which excludes it). `getSupportedThinkingLevels` also returns `"off"` as a member of a model's supported set. No new enum or type mapping is needed; the existing config `ReasoningLevelSchema` already matches the accepted value space exactly.

## Risks / Trade-offs

- [Risk] A future pi-ai/pi-coding-agent version could change `setThinkingLevel`'s clamping behavior or the semantics of `getSupportedThinkingLevels`, silently breaking the "skip when unsupported" guarantee. → Mitigation: the support check is an explicit, isolated membership test in pi-qol code (not inferred from `setThinkingLevel`'s side effects), so behavior stays predictable even if the host's internal clamping changes.
- [Risk] Silent skipping gives no feedback when a user's configured default never applies (e.g. a typo'd level, or consistently picking models that don't support it) — this could be confusing over time. → Mitigation: accepted trade-off per explicit user decision; the dialog's static display of the configured value gives an always-visible way to notice a misconfigured expectation without runtime noise.

## Open Questions

None — all decisions needed to implement this were resolved during exploration (see conversation), including the apply order, fallback semantics, "off" handling, and dialog display scope.
