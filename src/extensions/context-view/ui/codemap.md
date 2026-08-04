# src/extensions/context-view/ui/

## Responsibility

This folder contains the TUI components for the Context View feature. It renders an inline, half-height modal dialog with two tabs: **Usage** and **Injections**. Usage visualizes the estimated context-window composition with a proportional map, a selectable category legend, and a chronological content preview per category. Injections lists the hierarchical Initial snapshot of prompt/tool/context-file/skills injections with a per-item text preview. The modules are pure UI helpers: they do not call the Pi API directly and only depend on the shared `model.ts` types and the `@earendil-works/pi-tui` / `@earendil-works/pi-coding-agent` theme interfaces.

All modal plumbing — frame borders, tab strip, tab cycling, Vim key parsing, preview layers, dismissal ordering, height bounding, and the help footer — is owned by the shared modal library (`src/libs/modal/`). This folder keeps only Context View content: the two tab strategies and their bespoke rendering.

## Component/Model Structure

- `context-view-dialog.ts` — thin wrapper configuring a `ModalDialog` (Vim navigation scheme, half-height bound, degraded-reason notice) with the Usage and Injections tabs. Keeps the `Component`/`Focusable` surface and the `activeTab` accessor.
- `usage-view.ts` — the Usage tab (`ModalTab`). Stateful class that renders the context map, category legend, and zoom; category previews are pushed as `PreviewLayer`s. Uses `UsageMap`, `LegendRow`, `UsageMapScale`, `ListNavigator`, and `RenderCache` from the modal library.
- `injections-view.ts` — the Injections tab (`ModalTab`). Stateful class that renders the hierarchical list of Initial snapshot rows; item previews are pushed as `PreviewLayer`s. Uses `InjectionRow` and the modal library's `ListNavigator`/`RenderCache`.
- `injections-model.ts` — pure presentation model for injections: flattens `InitialSnapshot` into `InjectionRow[]`, maps items by id, and normalizes preview text. (`ListNavigator`/`PreviewScroller` moved to the modal library.)
- `usage-map.ts` — pure map model: `UsageMap` and `UsageMapCell` plus `buildUsageMap` / `calculateFitMapScale` for the 14×14 proportional grid.
- `skill-preview.ts` — pure text splitter: `splitSkillPreview` recognizes complete `<skill name="...">...</skill>` wrappers and emits `SkillPreviewSegment[]`.

## Design Patterns

- **Shell + tab strategy**: `ContextViewDialog` is a `ModalDialog` configuration; the views implement `ModalTab` (`label`, `render(width, height)`, `handleInput`, `handleNavigation`, `hints`, `attach`, `invalidate`) and never touch framing, tab cycling, or dismissal.
- **Per-tab preview layers**: Enter pushes a `PreviewLayer` onto the tab's shell-managed layer stack via `ModalTabContext.pushLayer`. Esc pops the layer before closing the dialog; tab switching works with layers open and each tab keeps its own stack.
- **Stateful retained tabs**: the dialog constructs both tabs once; each preserves selection, scroll, zoom, and layer state across switches; `invalidate()` clears caches when the theme changes.
- **Render caching**: both views cache rendered lines via the modal library's `RenderCache`, keyed by `width` and content `height`; the cache clears on selection, navigation, or zoom changes.
- **Pure model + view split**: `injections-model.ts`, `usage-map.ts`, and `skill-preview.ts` contain no Pi or TUI access and are unit-testable; the views own only rendering logic.
- **Semantic navigation**: the dialog's `VimNavigationScheme` maps keys to `NavigationAction`s (`step-*`, `page-*`, `first`, `last`, `confirm`, `dismiss`); tabs receive actions via `handleNavigation` and only raw, unmapped keys (Usage's `z` zoom) via `handleInput`.

## Rendering/Input/Data Flow

1. Opening: `index.ts` calls `prepareContextViewData`, then `ctx.ui.custom(...)` to create a `ContextViewDialog` with `usage`, `initial`, and optional `degradedReason`.
2. The dialog configures `ModalDialog` with `height: 'half'`, `VimNavigationScheme`, the degraded reason as a warning notice, and both tabs.
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
- **Preview**: Enter on a category pushes a `PreviewLayer` with a chronological list of `UsagePreviewEntry` lines. Headers show `[DD-MM-YYYY HH:MM:SS]`, breadcrumbs, visible tokens, and optional invisible-reasoning metadata (`≈` provider-reported, `~` signature proxy, `Encoded` when a replay signature is present). A fixed description about reasoning markers is shown only for `agent-thinking-messages` categories that contain invisible reasoning.
- **Hints**: the shell footer shows scheme movement keys (`↑↓/jk` Navigate, `Ctrl+u/d` Page, `gg/G` Bounds), tab hints (`Enter` Preview, `Z` Zoom when active), and universal hints (`Tab` Switch, `Esc` Close/`Back`).

## Injections Tab Behavior

- `InjectionsView` receives an `InitialSnapshot`.
- **List**: `injections-model.ts` flattens snapshot groups into `InjectionRow` of kind `group`, `item` (depth 1 or 2), `separator`, and `total`. Groups are source-level rows; depth-2 items are child constituents (e.g. individual built-in tools or skills). Only item rows are selectable and previewable.
- **Tree rendering**: items render with `├─ ` / `└─ ` prefixes and ancestor `│  ` continuation markers.
- **Value column**: the token-value column is aligned across the whole list based on the widest visible label and the widest token value.
- **Header**: shows `Context Injections · [INITIAL]`; a Runtime label is reserved for future work but currently hidden.
- **Degraded indicator**: when a degraded reason is present, the shell renders it as a warning notice below the tab strip (unified with the Usage tab).
- **Preview**: Enter on an item pushes a `PreviewLayer` showing the item label, source, and token count; the body is wrapped and indented with `BODY_INDENT`.
- **Hints**: same shell-composed footer as Usage.

## Skill Preview Behavior

- `usage-view.ts` compacts skill wrappers in user-messages preview content by setting `compactSkills = true` for `user-messages` category entries.
- `skill-preview.ts` splits text on line-delimited `<skill name="...">` and `</skill>` tags. Only complete wrappers (matching opening and closing on the same boundary, with no other skill opening tag between them) are emitted as `SkillPreviewSegment` of type `skill`. Malformed or unclosed wrappers remain as `text` segments.
- `UsageView.skillBadge` renders a skill segment as a colored badge: `[skill]` in `customMessageLabel` and the name in `customMessageText`. This matches the colors used by Pi's transcript component for skill attachments.
- Non-user-messages categories keep skills inline as raw text (no compact badges).

## Integration Points

- **Entry**: `index.ts` calls `openContextView`, which uses `ctx.ui.custom<void>` to instantiate `ContextViewDialog`. This attaches the dialog to the Pi TUI.
- **Modal library**: `src/libs/modal/` supplies `ModalDialog`, `VimNavigationScheme`, `ModalTab`/`ModalTabContext` contracts, `ListNavigator`, `PreviewLayer`, `RenderCache`, and layout/text helpers (`BODY_INDENT`, `calculateViewport`, `fitLine`, `spreadLine`, `wrapDescriptionLines`).
- **Data contract**: `ContextViewData` from `context-view-controller.ts` supplies `{ initial, usage, degradedReason }`; the dialog maps `degradedReason` to the shell notices slot.
- **Usage data source**: `usage.ts` produces `ContextUsageSnapshot` via `computeUsage`, which merges the frozen `InitialSnapshot` with live session messages and reported provider usage. `usage.ts` also provides `collectPreviewEntries`, which `UsageView` uses to flatten a category's chronological entries.
- **Theme**: views receive a `Theme` from the Pi TUI and use semantic colors (`accent`, `muted`, `dim`, `text`, `warning`, `mdHeading`, `mdLink`, `mdCodeBlock`, `syntaxString`, `syntaxFunction`, `syntaxKeyword`, `syntaxType`, `thinkingHigh`, `thinkingXhigh`, `toolOutput`, `customMessageLabel`, `customMessageText`, `border`).
- **Height contract**: the shell bounds the dialog to half the terminal height and hands each tab an exact content height to fill.
- **Process-local content**: preview text and injection text are not sanitized for persistence (control sequences are stripped for terminal display only). This matches the parent `model.ts` constraint that raw content must never be logged or serialized.

## Files

- `context-view-dialog.ts`: `ModalDialog` configuration (Vim scheme, half-height, notices) and the `activeTab` accessor.
- `usage-view.ts`: Usage tab — dashboard, map, legend, zoom, category preview layer, reasoning description.
- `injections-view.ts`: Injections tab — hierarchy list, item preview layer.
- `injections-model.ts`: row flattening, item indexing, text normalization.
- `usage-map.ts`: 14×14 proportional grid and Fit-scale calculation.
- `skill-preview.ts`: skill wrapper splitting for compact badge rendering.
