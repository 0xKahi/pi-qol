# src/extensions/context-view/ui/

## Responsibility

This folder contains the TUI components for the Context View feature. It renders a half-height modal dialog, mounted inline by default or as a centered overlay, with two tabs: **Usage** and **Injections**. Usage visualizes the estimated context-window composition with a proportional map, a selectable category legend, and a chronological content preview per category. Injections lists the hierarchical Initial snapshot of prompt/tool/context-file/skills injections with a per-item text preview. The modules are pure UI helpers: they do not call the Pi API directly and only depend on the shared `model.ts` types and the `@earendil-works/pi-tui` / `@earendil-works/pi-coding-agent` theme interfaces.

All modal plumbing — frame borders, tab strip, tab cycling, Vim key parsing, preview layers, dismissal ordering, height bounding, and the help footer — is owned by the shared modal library (`src/libs/modal/`). This folder keeps only Context View content: the two tab strategies and their bespoke rendering.

## Component/Model Structure

- `context-view-dialog.ts` — thin wrapper configuring a `ModalDialog` (presenter-resolved frame, Vim navigation scheme, half-height bound, degraded-reason notice) with the Usage and Injections tabs. Reads the host wheel step via `readWheelScrollLines(tui)` and threads it into both tabs so their wheel-aware preview layers match the transcript viewport (block streams still step one block per notch). Keeps the `Component`/`Focusable` surface and the `activeTab` accessor.
- `usage-view.ts` — the Usage tab (`ModalTab`). Stateful class that renders the context map, category legend, and zoom; category previews are pushed as wheel-aware block layers. Uses `UsageMap`, `LegendRow`, `UsageMapScale`, `ListNavigator`, `RenderCache`, and `previewBodyLines`/`previewLegendLines` from the section preview.
- `injections-view.ts` — the Injections tab (`ModalTab`). Stateful class that renders the hierarchical list of Initial snapshot rows, dropped/moved row markers, and the marker legend; item previews are pushed as wheel-aware layers. Uses `InjectionRow`, `previewBodyLines`/`previewLegendLines`, and the modal library's `ListNavigator`/`RenderCache`.
- `injections-model.ts` — pure presentation model for injections: flattens `InitialSnapshot` into `InjectionRow[]` (carrying dropped/moved state), maps items by id. Terminal sanitizers are re-exported from `../text`. (`ListNavigator`/`PreviewScroller` live in the modal library.)
- `section-preview.ts` — section-aware preview rendering: `previewBodyLines` renders labeled parts with token subheaders, dropped/moved markers, repeated-heading trimming, and restored injected references; `previewLegendLines` collapses one fixed marker legend to the rows a frame can spare.
- `markers.ts` — fixed-color state markers (`droppedMarker`, `movedMarker`, `guessMarker`) and the ordered, deduplicated bullet legend (`markerLegendLines`).
- `json-preview.ts` — preview-only JSON run expansion (`expandJsonSpan`) and span re-anchoring (`shiftJsonSpan`).
- `wheel.ts` — SGR/X10 mouse-wheel report parsing (`parseWheelDirection`) and the defensive TUI step read (`readWheelScrollLines`).
- `wheel-preview-layer.ts` — preview layer mirroring the shared frame while accepting wheel notches; honors the host wheel step passed by the dialog.
- `usage-block-layer.ts` — selectable chronological Usage block stream with per-block caps and wheel stepping.
- `usage-preview.ts` — pure block geometry and `BlockNavigator` selection/scroll state for the Usage preview.
- `usage-map.ts` — pure map model: `UsageMap` and `UsageMapCell` plus `buildUsageMap` / `calculateFitMapScale` for the 14×14 proportional grid.
- `skill-preview.ts` — pure text splitter: `splitSkillPreview` recognizes complete `<skill name="...">...</skill>` wrappers and emits `SkillPreviewSegment[]`.

## Design Patterns

- **Shell + tab strategy**: `ContextViewDialog` is a `ModalDialog` configuration; the views implement `ModalTab` (`label`, `render(width, height)`, `handleInput`, `handleNavigation`, `hints`, `attach`, `invalidate`) and never touch framing, tab cycling, or dismissal.
- **Per-tab preview layers**: Enter pushes a layer onto the tab's shell-managed layer stack via `ModalTabContext.pushLayer`. Esc pops the layer before closing the dialog; tab switching works with layers open and each tab keeps its own stack. Context View layers are wheel-aware (`wheel-preview-layer.ts`, `usage-block-layer.ts`), unlike the shared scroll-only `PreviewLayer`.
- **Stateful retained tabs**: the dialog constructs both tabs once; each preserves selection, scroll, zoom, and layer state across switches; `invalidate()` clears caches when the theme changes.
- **Render caching**: both views cache rendered lines via the modal library's `RenderCache`, keyed by `width` and content `height`; the cache clears on selection, navigation, or zoom changes.
- **Pure model + view split**: `injections-model.ts`, `usage-map.ts`, `usage-preview.ts`, `markers.ts`, `json-preview.ts`, `wheel.ts`, and `skill-preview.ts` contain no Pi or TUI access and are unit-testable; the views own only rendering logic.
- **Semantic navigation**: the dialog's `VimNavigationScheme` maps keys to `NavigationAction`s (`step-*`, `page-*`, `first`, `last`, `confirm`, `dismiss`); tabs receive actions via `handleNavigation` and only raw, unmapped keys (Usage's `z` zoom, wheel reports) via `handleInput`.

## Rendering/Input/Data Flow

1. Opening: `index.ts` calls `prepareContextViewData`, then `presentModal(...)` creates a `ContextViewDialog` with `usage`, `initial`, optional `degradedReason`, and the frame resolved from `context_view.layout`.
2. The presenter configures mounting and frame from `context_view.layout`; the dialog configures `ModalDialog` with `height: 'half'`, `VimNavigationScheme`, the degraded reason as a warning notice, and both tabs.
3. On each render cycle the shell renders the frame, tab strip, notices, the active tab's content region (exact bounded height), and the help footer composed of scheme hints, active tab/layer hints, and universal hints.
4. Input: the shell handles `Tab`/`Shift+Tab` cycling first, then the Vim scheme. `dismiss` pops the active tab's top layer or closes the dialog; other actions go to the top layer, else the active tab; unmapped raw keys go to the layer or tab.
5. Tabs handle list navigation, preview opening (confirm action), and view-local keys. After handling, `tui.requestRender()` is called by the shell.
6. Data stays process-local: raw text used in previews comes from `InjectionItem.text` and `UsagePreviewEntry.text`, both declared as never-logged / never-persisted in `model.ts`.

## Usage Tab Behavior

- `UsageView` receives a `ContextUsageSnapshot`.
- **Dashboard**: renders a header, a 14×14 proportional map, a selectable category legend, and a description within the shell-provided content height. At narrow widths the map is hidden; at ≥52 columns it appears beside the legend; at ≥72 columns cells are spaced.
- **Map cells**: `full` (■), `partial` (◧), `compacted-data` (▦), `buffer` (⛝), `free` (⛶). Compacted data uses its own glyph; all other categories use full/partial based on overlap.
- **Legend**: top-level categories plus one level of children under `tool-output` (per-tool breakdown). Buffer and free rows are shown when applicable but are not selectable.
- **Zoom**: pressing `z` toggles `UsageMapScale` between `window` and `fit`. Fit adds 15% headroom, rounded up to two significant digits, capped by the context window and floored at 10,000 tokens. Zoom only works when the active width supports the side-by-side map and the fit scale is smaller than the window. The `Z Zoom` hint appears only when active.
- **Summary header**: shows model label, reported tokens / context window, and reported percentage. When provider tokens are unknown, it shows estimated tokens and a computed percentage.
- **Preview**: Enter on a category pushes a wheel-aware block stream (`UsageBlockLayer`) of chronological `UsagePreviewEntry` blocks. Body content is section-aware (`previewBodyLines`): labeled parts carry token subheaders, dropped/moved markers, repeated-heading trimming, restored injected references with their source/tool/guess attribution, and expanded JSON runs. Entry headers bold the lead breadcrumb cell. Headers show `[DD-MM-YYYY HH:MM:SS]`, breadcrumbs, visible tokens, and optional invisible-reasoning metadata (`≈` provider-reported, `~` signature proxy, `Encoded` when a replay signature is present). A fixed description about reasoning markers is shown only for `agent-thinking-messages` categories that contain invisible reasoning; other categories show the collapsed marker legend. The full-content layer expands JSON too, accepts wheel notches at the host step, and repeats the same marker legend when its body leaves room.
- **Hints**: the shell footer shows scheme movement keys (`↑↓/jk` Navigate, `Ctrl+u/d` Page, `gg/G` Bounds), tab hints (`Enter` Preview, `Z` Zoom when active), and universal hints (`Tab` Switch, `Esc` Close/`Back`).

## Injections Tab Behavior

- `InjectionsView` receives an `InitialSnapshot`.
- **List**: `injections-model.ts` flattens snapshot groups into `InjectionRow` of kind `group`, `item` (depth 1 or 2), `separator`, and `total`. Groups are source-level rows; depth-2 items are child constituents (e.g. individual built-in tools or skills). Only item rows are selectable and previewable.
- **Tree rendering**: items render with `├─ ` / `└─ ` prefixes and ancestor `│  ` continuation markers.
- **Value column**: the token-value column is aligned across the whole list based on the widest visible label and the widest token value.
- **Header**: shows `Context Injections · [INITIAL]`; a Runtime label is reserved for future work but currently hidden.
- **Degraded indicator**: when a degraded reason is present, the shell renders it as a warning notice below the tab strip (unified with the Usage tab).
- **Preview**: Enter on an item pushes a wheel-aware layer showing the item label, source, and token count; the body is section-aware (`previewBodyLines`) and wrapped with `BODY_INDENT`, expanding marked JSON runs and restoring attributed references, with the collapsed marker legend below. Rows carrying dropped/moved content show a state marker after their estimate, and the list description explains exactly those markers.
- **Hints**: same shell-composed footer as Usage.

## Skill Preview Behavior

- `usage-view.ts` compacts skill wrappers in user-messages preview content by setting `compactSkills = true` for `user-messages` category entries.
- `skill-preview.ts` splits text on line-delimited `<skill name="...">` and `</skill>` tags. Only complete wrappers (matching opening and closing on the same boundary, with no other skill opening tag between them) are emitted as `SkillPreviewSegment` of type `skill`. Malformed or unclosed wrappers remain as `text` segments.
- `UsageView.skillBadge` renders a skill segment as a colored badge: `[skill]` in `customMessageLabel` and the name in `customMessageText`. This matches the colors used by Pi's transcript component for skill attachments.
- Non-user-messages categories keep skills inline as raw text (no compact badges).

## Integration Points

- **Entry**: `index.ts` calls `openContextView`, which uses the shared `presentModal` helper to instantiate and mount `ContextViewDialog` in the configured layout.
- **Modal library**: `src/libs/modal/` supplies `ModalDialog`, `VimNavigationScheme`, `ModalTab`/`ModalTabContext` contracts, `ListNavigator`, `PreviewScroller`, `PreviewLayer`, `RenderCache`, and layout/text helpers (`BODY_INDENT`, `calculateViewport`, `fitLine`, `spreadLine`, `wrapDescriptionLines`). The Context View adds wheel-aware layers in this folder rather than editing the shared library.
- **Sanitizers**: `normalizePreviewText`/`normalizeInlineText` live in `../text`; `injections-model.ts` re-exports them for callers that import them there.
- **Data contract**: `ContextViewData` from `context-view-controller.ts` supplies `{ initial, usage, degradedReason }`; the dialog maps `degradedReason` to the shell notices slot.
- **Usage data source**: `usage.ts` produces `ContextUsageSnapshot` via `computeUsage`, which merges the frozen `InitialSnapshot` with live session messages and reported provider usage. `usage.ts` also provides `collectPreviewEntries`, which `UsageView` uses to flatten a category's chronological entries.
- **Theme**: views receive a `Theme` from the Pi TUI and use semantic colors (`accent`, `muted`, `dim`, `text`, `warning`, `mdHeading`, `mdLink`, `mdCodeBlock`, `syntaxString`, `syntaxFunction`, `syntaxKeyword`, `syntaxType`, `thinkingHigh`, `thinkingXhigh`, `toolOutput`, `customMessageLabel`, `customMessageText`, `border`).
- **Height contract**: the shell bounds the dialog to half the terminal height and hands each tab an exact content height to fill.
- **Process-local content**: preview text and injection text are not sanitized for persistence (control sequences are stripped for terminal display only). This matches the parent `model.ts` constraint that raw content must never be logged or serialized.

## Files

- `context-view-dialog.ts`: `ModalDialog` configuration (Vim scheme, half-height, notices) and the `activeTab` accessor.
- `usage-view.ts`: Usage tab — dashboard, map, legend, zoom, category preview layers, reasoning description, marker legend.
- `injections-view.ts`: Injections tab — hierarchy list with state markers, marker legend, item preview layer.
- `injections-model.ts`: row flattening (dropped/moved aware), item indexing; sanitizer re-exports.
- `section-preview.ts`: section-aware preview bodies and marker legends.
- `markers.ts`: state markers and ordered legend bullets.
- `json-preview.ts`: JSON run expansion and span shifting.
- `wheel.ts`: wheel-report parsing and TUI step read.
- `wheel-preview-layer.ts`: wheel-aware preview layer.
- `usage-block-layer.ts`: chronological Usage block stream with caps and wheel stepping.
- `usage-preview.ts`: block geometry and navigation state.
- `usage-map.ts`: 14×14 proportional grid and Fit-scale calculation.
- `skill-preview.ts`: skill wrapper splitting for compact badge rendering.
