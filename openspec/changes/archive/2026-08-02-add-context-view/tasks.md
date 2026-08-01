## 1. Configuration and Feature Scaffolding

- [x] 1.1 Add full and partial `context_view` configuration schemas with `enabled: false` as the default, compose them into the top-level schemas, and expose a typed `ConfigLoader` getter.
- [x] 1.2 Add `context_view` to pi-qol's sub-extension IDs and define `/context-view` plus `pi.vimKeys.event:pi-qol.context_view` constants in the new feature module.
- [x] 1.3 Create the `src/extensions/context-view/` module structure and register `registerContextView` from `src/index.ts` using the shared `ConfigLoader` dependency.
- [x] 1.4 Add schema tests covering omitted defaults, enabled full config, partial overrides, and invalid values.

## 2. Upstream Domain Migration

- [x] 2.1 Port the semantic context/injection/usage models and grouping behavior from upstream commit `f6f007b867212bcf81a61519c8e40ce209cdd608`, retaining appropriate source provenance while applying pi-qol formatting conventions.
- [x] 2.2 Port system-prompt measurement, active-tool capture, token estimation, and source attribution as pure modules.
- [x] 2.3 Port usage classification, reported-usage conversion, category previews, invisible-reasoning handling, and auto-compaction reserve calculations.
- [x] 2.4 Port proportional usage-map, skill-preview, viewport/layout, injection-row, list-navigation, and preview-scrolling helpers into cohesive UI/domain modules.
- [x] 2.5 Migrate and adapt upstream unit tests for models, measurement, usage classification, map calculation, injection rows, preview handling, width fitting, and terminal-height bounds.

## 3. Capture and Probe Lifecycle

- [x] 3.1 Implement feature-guarded lifecycle capture that owns copies of the latest structured prompt inputs and freezes the first eligible initial provider-context snapshot.
- [x] 3.2 Implement the single-attempt silent-probe state machine, probe-turn abort/sanitization, timeout and failure fallback, and exact synthetic message filtering.
- [x] 3.3 Persist and restore only synthetic probe role/timestamp identities across session lifecycle boundaries, ensuring captured context content is never serialized or logged.
- [x] 3.4 Build shared view-data preparation for both command and ordinary event contexts, including conditional command-context idle waiting and Pi-native degraded fallback.
- [x] 3.5 Add lifecycle tests for passive capture, concurrent/single probe attempts, timeout/failure, message sanitation, identity restoration, disabled behavior, and event-context data preparation.

## 4. Unified Tabbed Interface

- [x] 4.1 Refactor the upstream Usage fullscreen view into a stateful Usage tab that preserves category selection, viewport, preview scroll, and map zoom state without owning a separate overlay.
- [x] 4.2 Refactor the upstream Injections fullscreen view into a stateful Injections tab that preserves hierarchy selection, viewport, and preview scroll state without owning a separate overlay.
- [x] 4.3 Implement the bounded half-height inline `ContextViewDialog` shell with Usage as the default tab, responsive tab styling, shared borders/help, and `Tab`/`Shift+Tab` switching from both parent and preview states.
- [x] 4.4 Implement shared semantic input handling for arrows and `j`/`k` single-step movement, `Ctrl+u`/`Ctrl+d` page movement, `gg`/`G` boundaries, Enter preview, and Esc/q back-or-close behavior.
- [x] 4.5 Ensure PageUp/PageDown/Home/End no longer perform page or boundary navigation and update all visible hints to show only supported controls.
- [x] 4.6 Add dialog and child-tab tests for default tab selection, forward/reverse tab wrapping, per-tab state retention, preview tab switching, every Vim binding, interrupted `g` sequences, replaced keys, and narrow/short rendering.

## 5. Command and Vim Event Integration

- [x] 5.1 Implement the argument-free `/context-view` handler with enabled, argument-validation, and TUI-mode guards, opening the unified dialog through the shared controller.
- [x] 5.2 Implement the model-select-style latest-context cache and `pi.vimKeys.event:pi-qol.context_view` listener, invoking the same opening path and reporting asynchronous failures through the cached UI.
- [x] 5.3 Add controller tests verifying command and Vim event parity, Usage-first openings, disabled/no-context no-ops, invalid argument handling, and non-TUI handling.

## 6. Documentation and Generated Artifacts

- [x] 6.1 Add a README Context View section documenting configuration, `/context-view`, tabs, Vim controls, and the `pi.vimKeys.event:pi-qol.context_view` integration event.
- [x] 6.2 Credit Dmitry Makarov, link the original `pi-context-view` project, and state that pi-qol Context View is a fork with a unified tabbed interface and Vim-friendly keybindings.
- [x] 6.3 Regenerate `assets/config.schema.json` and verify the published package's existing source/assets inclusion covers the new extension.
- [x] 6.4 Update repository and affected-folder codemaps to describe Context View architecture, lifecycle flow, configuration, command, event, and UI integration points.

## 7. Verification

- [x] 7.1 Run all Context View and existing pi-qol tests and resolve regressions without weakening migrated behavior coverage.
- [x] 7.2 Run type checking, linting, formatting/check scripts, and JSON Schema generation verification.
- [x] 7.3 Manually exercise enabled and disabled startup, `/context-view`, the Vim event, both tabs and previews, silent first-turn probing, degraded fallback, and all documented navigation keys in Pi TUI.
