# Standardize Modal Rendering

## Why

`model-select` and `context-view` each implement their own modal dialog from scratch, duplicating tab strips, tab cycling, focus plumbing, list-selection state, line fitting, and dismissal handling. Inside `context-view` itself, `UsageView` and `InjectionsView` carry verbatim-identical navigation-dispatch and preview-mode code. Every future modal would copy this boilerplate again, and any fix to modal behavior has to be made in multiple places. A shared, self-contained modal library makes new modals cheap to build and gives modal rendering logic one central home — in this plugin and, by copying the folder, in other Pi plugins.

## What Changes

- Add a new shared modal UI library under `src/libs/modal/` providing:
  - A `ModalDialog` shell that owns framing, the tab strip, tab cycling, an input layer stack, an optional filter-input slot, a notices slot, focus plumbing, the help footer, and the done/cancel lifecycle.
  - A pluggable navigation-scheme strategy: a default scheme driven by the host `KeybindingsManager` (`tui.select.*`) and a Vim scheme (`j/k`, `gg/G`, `Ctrl+u/d`, `q`) for read-only inspector modals.
  - A shared list navigator with clamp-at-bounds by default and an opt-in wrap-around mode.
  - A generic selectable-list tab implementation covering the common "pick from a list" case.
  - A reusable scrollable preview layer, where dismissal pops the layer before closing the dialog.
  - Frame styles reproducing today's layouts: inline rules, rounded border, and bounded (half-height) height.
  - A width-aware tab strip (ported from `model-select`) with dynamic tab labels.
- Keep the library self-contained: it may import only from Pi host packages (`pi-tui`, `pi-coding-agent` types) and never from pi-qol modules, so the folder can be copied into other plugins unchanged.
- Migrate `ModelSelectDialog` onto the library, preserving its current behavior (keybindings navigation, wrap-around selection, shared filter input, inline/overlay layouts).
- Migrate `ContextViewDialog`, `UsageView`, and `InjectionsView` onto the library, preserving their current behavior (Vim navigation, clamped selection, retained per-tab state, preview layers, half-height bound).
- Delete the duplicated navigation/preview/list-state code absorbed by the library.

## Capabilities

### New Capabilities
- `modal-ui`: Shared modal dialog library — shell, navigation schemes, tabs, layer stack, framing, and text/layout helpers for building consistent TUI modals.

### Modified Capabilities
<!-- Existing modal behaviors (navigation keys, wrap/clamp, tab cycling, retained state, half-height bound, layouts) are intentionally preserved, so no existing requirement changes. -->

## Impact

- **New code**: `src/libs/modal/` (shell, navigation schemes, tab interface + generic list tab, preview layer, list navigator, framing, tab strip, text helpers) and its tests.
- **Refactored code**: `src/extensions/model-select/model-select-dialog.ts`, `src/extensions/context-view/ui/context-view-dialog.ts`, `usage-view.ts`, `injections-view.ts`.
- **Moved code**: `src/extensions/context-view/ui/navigation.ts`, `layout.ts`, and the `ListNavigator`/`PreviewScroller` from `injections-model.ts` are absorbed into the library; the fork-attribution headers are preserved on moved code.
- **Behavior**: no user-facing behavior change intended; existing spec requirements for `context-view` and `model-select-*` remain satisfied.
- **Dependencies**: none added; the library uses existing peer dependencies only.
