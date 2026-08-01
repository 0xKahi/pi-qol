# src/extensions/context-view/

## Responsibility

Provides optional inspection of model-context occupancy and initial context injections. It is disabled by default and lazily registers capture, command, and Vim-event integration only after an enabled session starts.

## Architecture

- `index.ts`: registration, lifecycle hooks, synthetic-probe filtering/persistence, `/context-view`, and `pi.vimKeys.event:pi-qol.context_view`.
- `capture.ts`: owned prompt inputs, capture-once snapshot state, active tools, context-only messages, and single-attempt probe state.
- `context-view-controller.ts`: shared command/event data preparation and degraded native fallback.
- `model.ts`, `measure.ts`, `usage.ts`: pure semantic models, prompt/tool measurement, and usage classification.
- `ui/context-view-dialog.ts`: bounded half-height inline shell, visible Usage/Injections tabs, tab state retention, and global input routing.
- `ui/usage-view.ts`, `ui/injections-view.ts`: stateful child views and previews.
- `ui/navigation.ts`: shared `j/k`, arrows, `Ctrl+u/d`, `gg/G` semantics; PageUp/PageDown/Home/End are intentionally ignored.
- Other `ui/` modules provide map, layout, hierarchy, scrolling, sanitization, and skill-preview helpers.

## Data Flow

1. Enabled `session_start` lazily installs the feature and restores persisted role/timestamp probe identities.
2. `before_agent_start` owns structured prompt options; `context` freezes the first eligible provider snapshot.
3. Opening before capture attempts one silent empty probe; exact synthetic messages are aborted, sanitized, filtered, and persisted by identity only.
4. The controller combines the initial snapshot, current native prompt/tool data, filtered session messages, and reported usage.
5. `ContextViewDialog` opens Usage-first as an inline component bounded to 50% of terminal height and preserves both child states while tabs switch.

## Constraints

Captured prompt, tool, skill, context-file, and message content remains process-local and must never be logged or serialized. Only synthetic probe role/timestamp identities may be persisted.
