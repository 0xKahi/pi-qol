# src/extensions/context-view/ui/

## Responsibility

This folder contains the TUI components for the Context View feature. It renders an inline, half-height modal dialog with two tabs: **Usage** and **Injections**. Usage visualizes the estimated context-window composition with a proportional map, a selectable category legend, and a chronological content preview per category. Injections lists the hierarchical Initial snapshot of prompt/tool/context-file/skills injections with a per-item text preview. The modules are pure UI helpers: they do not call the Pi API directly and only depend on the shared `model.ts` types and the `@earendil-works/pi-tui` / `@earendil-works/pi-coding-agent` theme interfaces.

## Component/Model/Layout/Navigation Structure

- `context-view-dialog.ts` — top-level shell implementing `Component` and `Focusable`. It owns `UsageView` and `InjectionsView` instances, renders the tab bar, and delegates input. It bounds the dialog to half the terminal height.
- `usage-view.ts` — the Usage tab. Stateful class that renders the context map, category legend, and preview mode. Uses `UsageMap`, `LegendRow`, `UsageMapScale`, and `PreviewScroller`.
- `injections-view.ts` — the Injections tab. Stateful class that renders the hierarchical list of Initial snapshot rows and the item preview mode. Uses `InjectionRow`, `ListNavigator`, and `PreviewScroller`.
- `injections-model.ts` — pure presentation model for injections: flattens `InitialSnapshot` into `InjectionRow[]`, maps items by id, normalizes preview text, and contains `ListNavigator` (list selection + viewport) and `PreviewScroller` (preview scroll offset).
- `usage-map.ts` — pure map model: `UsageMap` and `UsageMapCell` plus `buildUsageMap` / `calculateFitMapScale` for the 14×14 proportional grid.
- `skill-preview.ts` — pure text splitter: `splitSkillPreview` recognizes complete `<skill name="...">...</skill>` wrappers and emits `SkillPreviewSegment[]`.
- `layout.ts` — shared layout helpers: `BODY_INDENT`, `calculateViewport`, `fitToTerminalHeight`, `fitLine`, `spreadLine`, `hintRow`, `wrapDescriptionLines`, and `normalizeTerminalRows`.
- `navigation.ts` — shared input parser: `VimNavigation` maps keys to `NavigationAction` (`step-back`, `step-forward`, `page-back`, `page-forward`, `first`, `last`). It explicitly swallows `PageUp`/`PageDown`/`Home`/`End`.

## Design Patterns

- **Stateful retained views**: `ContextViewDialog` creates both child views once and keeps them alive across tab switches; `invalidate()` clears both caches when the theme changes.
- **Render caching**: both views cache the last rendered line array keyed by `width` and `terminalRows`; `clearCache()` is called on selection, navigation, zoom, or preview open/close.
- **Pure model + view split**: `injections-model.ts` and `usage-map.ts` / `skill-preview.ts` contain no Pi or TUI access and are unit-testable; `usage-view.ts` and `injections-view.ts` own only rendering logic.
- **Shared viewport math**: `calculateViewport` and `fitToTerminalHeight` centralize terminal-height accounting so the top border, header, list, description, hints, and bottom border stay within the allocated half-height.
- **Vim navigation delegation**: `ContextViewDialog` feeds every key first to `VimNavigation`; if it yields an action, the action is passed to the active child; otherwise the raw key is passed to the child.
- **Tab-bar overlay**: the dialog renders the child view lines, then prefixes the first line with the tab bar `[Usage] [Injections]`. The active tab is accent/bold; the inactive tab is muted.

## Rendering/Input/Data Flow

1. Opening: `index.ts` calls `prepareContextViewData`, then `ctx.ui.custom(...)` to create a `ContextViewDialog` with `usage`, `initial`, and optional `degradedReason`.
2. `ContextViewDialog` constructs `UsageView` and `InjectionsView` and sets a `getTerminalRows` callback that returns `Math.max(1, Math.floor(tui.terminal.rows / 2) - 1)`.
3. On each render cycle, `TUI` calls `render(width)` on the dialog, which calls `render(width)` on the active child and overlays the tab bar.
4. Input: `handleInput(data)` checks `Key.tab` / `Shift+Tab` to switch tabs, then runs `VimNavigation.consume(data)`. If the parser returns a `NavigationAction`, it is forwarded to the active child via `handleNavigation`. If the parser marks the key as unhandled, the raw key is forwarded to the child via `handleInput`.
5. Child views handle list navigation, preview scrolling, and special keys (Enter to open preview, Escape/q to close, z to toggle map zoom in Usage). After handling, `tui.requestRender()` is called by the dialog.
6. Data stays process-local: raw text used in previews comes from `InjectionItem.text` and `UsagePreviewEntry.text`, both declared as never-logged / never-persisted in `model.ts`.

## Usage Tab Behavior

- `UsageView` receives a `ContextUsageSnapshot` and optional `degradedReason`.
- **Dashboard**: renders a header, a 14×14 proportional map, a selectable category legend, a description, and a hint row. At narrow widths the map is hidden; at ≥52 columns it appears beside the legend; at ≥72 columns cells are spaced.
- **Map cells**: `full` (■), `partial` (◧), `compacted-data` (▦), `buffer` (⛝), `free` (⛶). Compacted data uses its own glyph; all other categories use full/partial based on overlap.
- **Legend**: top-level categories plus one level of children under `tool-output` (per-tool breakdown). Buffer and free rows are shown when applicable but are not selectable.
- **Zoom**: pressing `z` toggles `UsageMapScale` between `window` and `fit`. Fit adds 15% headroom, rounded up to two significant digits, capped by the context window and floored at 10,000 tokens. Zoom only works when the active width supports the side-by-side map and the fit scale is smaller than the window.
- **Summary header**: shows model label, reported tokens / context window, and reported percentage. When provider tokens are unknown, it shows estimated tokens and a computed percentage.
- **Preview mode**: press Enter on a category to open a chronological list of `UsagePreviewEntry` lines. Headers show `[DD-MM-YYYY HH:MM:SS]`, breadcrumbs, visible tokens, and optional invisible-reasoning metadata (`≈` provider-reported, `~` signature proxy, `Encoded` when a replay signature is present). A fixed description about reasoning markers is shown only for `agent-thinking-messages` categories that contain invisible reasoning.
- **Hints**: `↑↓/jk` Navigate, `Ctrl+u/d` Page, `gg/G` Bounds, `Enter` Preview, `Z` Zoom (when active), `Esc` Close. In preview mode, the same bindings scroll the content and `Esc` returns to the list.

## Injections Tab Behavior

- `InjectionsView` receives an `InitialSnapshot` and optional `degradedReason`.
- **List**: `injections-model.ts` flattens snapshot groups into `InjectionRow` of kind `group`, `item` (depth 1 or 2), `separator`, and `total`. Groups are source-level rows; depth-2 items are child constituents (e.g. individual built-in tools or skills). Only item rows are selectable and previewable.
- **Tree rendering**: items render with `├─ ` / `└─ ` prefixes and ancestor `│  ` continuation markers.
- **Value column**: the token-value column is aligned across the whole list based on the widest visible label and the widest token value.
- **Header**: shows `Context Injections · [INITIAL]`; a Runtime label is reserved for future work but currently hidden.
- **Degraded indicator**: when `degradedReason` is present, a warning line is rendered above the list and `[Degraded: pi-native fallback used]` is appended to the description.
- **Preview mode**: press Enter on an item to open its raw text. The preview shows the item label, source, and token count; the body is wrapped and indented with `BODY_INDENT`.
- **Hints**: same navigation set as Usage; `Enter` opens preview, `Esc` closes the dialog or returns from preview.

## Skill Preview Behavior

- `usage-view.ts` compacts skill wrappers in user-messages preview content by setting `compactSkills = true` for `user-messages` category entries.
- `skill-preview.ts` splits text on line-delimited `<skill name="...">` and `</skill>` tags. Only complete wrappers (matching opening and closing on the same boundary, with no other skill opening tag between them) are emitted as `SkillPreviewSegment` of type `skill`. Malformed or unclosed wrappers remain as `text` segments.
- `UsageView.skillBadge` renders a skill segment as a colored badge: `[skill]` in `customMessageLabel` and the name in `customMessageText`. This matches the colors used by Pi's transcript component for skill attachments.
- Non-user-messages categories keep skills inline as raw text (no compact badges).

## Integration Points

- **Entry**: `index.ts` calls `openContextView`, which uses `ctx.ui.custom<void>` to instantiate `ContextViewDialog`. This attaches the dialog to the Pi TUI.
- **Data contract**: `ContextViewData` from `context-view-controller.ts` supplies `{ initial, usage, degradedReason }`. `UsageViewInput` and `InjectionsViewInput` consume those fields.
- **Usage data source**: `usage.ts` produces `ContextUsageSnapshot` via `computeUsage`, which merges the frozen `InitialSnapshot` with live session messages and reported provider usage. `usage.ts` also provides `collectPreviewEntries`, which `UsageView` uses to flatten a category's chronological entries.
- **Capture fallback**: when the Initial snapshot is unavailable, `context-view-controller.ts` may trigger a silent probe or synthesize a degraded reason. `degradedReason` is rendered by both tabs as a warning line.
- **Theme**: views receive a `Theme` from the Pi TUI and use semantic colors (`accent`, `muted`, `dim`, `text`, `warning`, `mdHeading`, `mdLink`, `mdCodeBlock`, `syntaxString`, `syntaxFunction`, `syntaxKeyword`, `syntaxType`, `thinkingHigh`, `thinkingXhigh`, `toolOutput`, `customMessageLabel`, `customMessageText`, `border`).
- **Navigation wiring**: `VimNavigation` is shared; both tabs and their previews consume the same `NavigationAction` set, and `ContextViewDialog` owns the shared instance so tab switches reset the `pendingG` state.
- **Height contract**: the dialog explicitly requests half of the terminal height; child views assume the returned value is authoritative and clamp/fit to it.
- **Process-local content**: preview text and injection text are not sanitized for persistence (control sequences are stripped for terminal display only). This matches the parent `model.ts` constraint that raw content must never be logged or serialized.

## Files

- `context-view-dialog.ts`: shell, tab switching, focusable component, height halving.
- `usage-view.ts`: Usage dashboard, map, legend, zoom, category preview, reasoning description.
- `injections-view.ts`: Injections list, hierarchy, item preview.
- `injections-model.ts`: row flattening, item indexing, text normalization, `ListNavigator`, `PreviewScroller`.
- `usage-map.ts`: 14×14 proportional grid and Fit-scale calculation.
- `skill-preview.ts`: skill wrapper splitting for compact badge rendering.
- `layout.ts`: shared terminal layout, viewport, fitting, hint, and description helpers.
- `navigation.ts`: shared Vim key parser and `NavigationAction` type.
