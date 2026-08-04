# src/libs/modal/

## Responsibility

`src/libs/modal/` is the shared modal dialog library for building consistent TUI modals: a shell that owns modal plumbing (framing, tab strip, tab cycling, per-tab input layers, shared filter input, notices, help footer, focus), pluggable navigation schemes, tab content strategies, a generic selectable-list tab, a scrollable preview layer, and pure text/layout helpers. Extensions supply tab data and content rendering only.

The library is self-contained: it imports only from Pi host packages (`@earendil-works/pi-tui`, `@earendil-works/pi-coding-agent` types) so the directory can be copied unchanged into other Pi plugin projects. A dependency-audit test enforces this. Fork-attribution headers on files originating from `dimk90/pi-context-view` (MIT) are preserved.

## Module Roles

- `types.ts` — Contracts: `NavigationAction`/`NavigationResult`/`NavigationScheme` (pure key→action mappers), `ModalTab` (content strategy), `ModalLayer`, `ModalTabContext` (`pushLayer`), `Hint`.
- `modal-dialog.ts` — `ModalDialog<TResult>` shell (`Component + Focusable`). Options: tabs, initial tab, navigation scheme (default `PiKeybindingsScheme`), frame (`inline` rules | `bordered` rounded border), height (`auto` | `half` terminal), title, notices (+ cap), filter, cancel value, completion callback. Routes input: tab cycling (`Tab`/`Shift+Tab`, wrapping, scheme reset) → scheme action (`dismiss` pops the active tab's layer stack or completes with the cancel value; other actions go to the top layer, else active tab) → raw keys (top layer, else filter input, else active tab). Renders frame, strip, notices, filter slot, content region (exact height when bounded), and a footer composed of scheme + tab/layer hints + universal hints. `complete(result)` resolves explicit results (for example selections).
- `presenter.ts` — `presentModal<TResult>` and `ModalLayout`: host-facing presenter that maps semantic inline/overlay layouts to the renderer frame and Pi custom-UI mounting options (centered 85%-width overlay with one-cell margin).
- `navigation/pi-scheme.ts` — `PiKeybindingsScheme`: maps host `tui.select.*` keybindings to actions (default scheme; stateless).
- `navigation/vim-scheme.ts` — `VimNavigationScheme`: `j/k`/arrows, `Ctrl+u/d`, `gg/G` chord (cleared by `reset()`), Enter confirm, Esc/`q` dismiss; swallows PageUp/PageDown/Home/End. For read-only inspectors; do not combine with a filter input.
- `tabs/list-tab.ts` — `ListTab<T>` generic picker tab: items + row renderer + confirm callback, optional fuzzy filtering (`filterText`) wired to the dialog filter, dynamic count labels, filter captions, footer hook (rendered below the list in all states), empty/no-match messages, fixed or height-driven window, clamp (default) or wrap selection.
- `preview-layer.ts` — `PreviewLayer`: title + right-aligned meta header, `PreviewScroller`-windowed body, overflow counter, optional pinned description; dismissal is shell-owned (pops the layer).
- `list-navigator.ts` — `ListNavigator` (selection + scroll window; clamp default, `wrap` option; `setRowCount` for filtered lists) and `PreviewScroller` (scroll-only window over wrapped lines). Forked from `pi-context-view`.
- `tab-strip.ts` — Width-aware tab strip: active label highlighted; overflow keeps a window around the active tab with `…` omission indicators. Labels are re-read each render.
- `text.ts` — Pure helpers: `fitLine`, `singleLine`, `padLine`, `spreadLine`, `hintRow`, `wrapDescriptionLines`, `calculateViewport`, `fitToTerminalHeight`, `normalizeTerminalRows`, `BODY_INDENT`, `STEP_KEY_HINT`. Forked from `pi-context-view`.
- `render-cache.ts` — `RenderCache`: width/height-keyed frame cache (`read`/`write`/`clear`) for stateful tabs.
- `index.ts` — Barrel exports.

## Data & Control Flow

1. An extension builds `ModalTab`s (commonly `ListTab`, or custom tabs using `ListNavigator`/`PreviewLayer`/`RenderCache`) and calls `presentModal` with a semantic layout. The presenter supplies the resolved frame and host mounting options while the extension constructs `ModalDialog` with its own height/scheme/filter options plus `cancelValue`/`onComplete`.
2. The shell attaches a `ModalTabContext` to each tab (for `pushLayer`) and applies any initial filter query.
3. The host (`ctx.ui.custom`) drives `render(width)` and `handleInput(data)`; the shell routes input per the order above and calls `tui.requestRender()` after input.
4. Confirm flows: scheme `confirm` → tab `handleNavigation` → tab's confirm callback → `dialog.complete(value)`. Dismissal pops the active tab's top layer first, then completes with the cancel value.

## Integration Points

- **Consumers**: `src/extensions/model-select/model-select-dialog.ts` (three `ListTab` sections, filter slot, both frame styles, wrap selection) and `src/extensions/context-view/ui/context-view-dialog.ts` (Vim scheme, half-height, notices; custom `UsageView`/`InjectionsView` tabs with `PreviewLayer` previews).
- **Host packages**: `pi-tui` (`Component`, `Focusable`, `Input`, `Key`, `matchesKey`, `fuzzyFilter`, width helpers), `pi-coding-agent` types (`ExtensionUIContext`, `Theme`, `KeybindingsManager`).
- **Tests**: `test/modal/` (schemes, shell behavior, self-containment audit).
