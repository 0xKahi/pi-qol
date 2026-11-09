# src/extensions/context-view/ui/

## Responsibility

Context View's retained Usage and Injections tabs and their preview layers. The shared modal library owns framing, tab/layer stacks, Vim navigation, raw input capture, normalized mouse forwarding, notices, and half-terminal-height bounding. The presenter selects inline (default) or centered overlay layout. Raw captured content stays process-local and is never logged or persisted; only display strings are terminal-sanitized.

## Module Roles

- `context-view-dialog.ts` — configures `ModalDialog` with Usage first, both retained tabs, Vim navigation, half-height bound, and the degraded-capture warning. Wires clipboard services to shell notices and forwards `handleMouse` to the shell.
- `usage-view.ts` — context summary, proportional map, selectable category legend, map zoom (`z`), percentage basis (`p`), category copy (`y`), and chronological category previews.
- `injections-view.ts` — hierarchical Initial snapshot, dropped/moved markers, Name/Content filter, item/group copy, and injection previews. Uses an exact padded content height; prompt/status, legend, and scroll rows are budgeted rather than appended conditionally.
- `injections-model.ts` — pure hierarchy flattening, item indexing, and `filterInjections`. Name matches retain their subtree; Content matches preview text including expanded JSON; ancestors of matches survive. Terminal sanitizers are re-exported from `../text`.
- `searchable-preview.ts` — scroll-only injection and complete-content layer with captured search editing, match count, current-match navigation, raw-content copy, and wheel handling. Reserves search/scroll rows to keep height stable; width changes recompute matches on rewrapped lines while preserving the current index where possible.
- `search.ts` — literal case-insensitive matching and match ranges. Query whitespace is collapsed/trimmed and regex syntax escaped; content filtering also collapses target whitespace.
- `highlight.ts` — ANSI-safe highlighting at visible-column offsets, with a distinct current-match style.
- `copy.ts` — `copyText`/`copyWithNotice` use Pi's clipboard helper (injectable for tests), normalize CRLF, trim leading newlines/trailing whitespace, and report success (3 seconds), empty content, or failure (5 seconds) through the shell footer notice.
- `usage-block-layer.ts` — selectable chronological blocks with height-dependent excerpt caps, `y` full-block copy, and Enter to open complete content only when truncated. `/` is deliberately unbound here.
- `usage-preview.ts` — pure block geometry and `BlockNavigator` selection/scroll state.
- `usage-map.ts` — pure 14×14 proportional map and fit-scale computation.
- `section-preview.ts` — section-aware body rendering and collapsed marker legends: token subheaders, repeated-heading trimming, dropped/moved markers, and restored attributed references.
- `json-preview.ts` — preview-only JSON expansion and span re-anchoring.
- `markers.ts` — fixed-color dropped/moved/guess markers and deduplicated legend.
- `skill-preview.ts` — recognizes complete line-delimited skill wrappers; malformed wrappers remain text. Usage user-message previews compact wrappers to Pi-colored skill badges; other categories preserve inline text.

`wheel.ts` (SGR/X10 parsing and host step lookup) and `wheel-preview-layer.ts` were removed. Wheel input now arrives through `handleMouse(event)` on Usage, Injections, block streams, and searchable previews. Only `type === 'wheel'` is handled; `wheelDelta` already includes host scroll step/acceleration and is not rescaled. Lists move selection, streams step blocks, and previews scroll lines, returning `{ handled: true }`; other mouse events return `undefined`.

## Input and Layer Flow

1. `prepareContextViewData` supplies `{ initial, usage, degradedReason }`; `presentModal` mounts the dialog in the configured layout.
2. The shell renders frame, tab strip, persistent notices, an exact-height content region, and footer hints (or a transient copy notice).
3. If the top layer, otherwise active tab, reports `capturesInput()`, raw input bypasses tab cycling and Vim mapping, and its editing hints replace normal hints.
4. Otherwise Tab/Shift+Tab cycles tabs, the Vim scheme maps `j/k`, arrows, `Ctrl+u/d`, `gg/G`, Enter and Esc/`q`, and unmapped keys reach the target. Dismiss pops a layer before closing. Each tab retains selection, scroll, and its layer stack across switches.
5. Mouse events are forwarded to the same target's optional `handleMouse` by the shell. Views do not parse terminal mouse escape sequences.

## Injections Behavior

- `[INITIAL]` is the only phase shown; Runtime remains hidden. Rows are source groups, nested items, separators, and a non-selectable total. Group rows can be selected for copy; only items open previews.
- Tree glyphs and a shared token-value column preserve alignment. Dropped/moved rows carry markers and a matching legend.
- `/` enters filter editing. Tab/Shift+Tab toggles Name/Content mode, Enter confirms, and Esc clears while editing. Outside editing Esc is shell dismissal; use `/` then Esc to clear an applied filter. Refresh selects the first visible row, or clears selection for no matches.
- Editing/applied filters reserve one prompt/status row within the fixed list viewport; short/no-match lists are padded.
- Enter opens `SearchablePreview` with sectioned text, JSON expansion, restored prompt references, and the marker legend.
- `y` copies a selected item's raw text or a group's filter-visible content, joined with blank lines. Pruned aggregate subtrees are reconstructed so hidden siblings do not leak into group copy.

## Usage Behavior

- Summary shows reported tokens/window and percentage, or estimates when provider tokens are unknown. The summary percentage always uses the window.
- The 14×14 map is hidden below 52 columns, side-by-side at 52+, and spaced at 72+. Cells represent full/partial occupancy, compacted data, buffer, and free space. Tool Output includes one level of child categories.
- `z` toggles window/fit map scale only when supported by the width and a smaller fit scale exists. Fit uses 15% headroom, rounded to two significant digits, capped by the window and floored at 10,000 tokens.
- `p` independently toggles legend percentages between `window` (default per dialog, reported context-window denominator) and `used` (`estimatedTokens`, the sum of estimated categories). It is enabled when either denominator is positive. Used mode shows percentages only for category rows, not buffer/free; the heading names the basis.
- Enter on a category opens chronological `UsageBlockLayer` entries, with section-aware excerpts, timestamps, breadcrumbs, token counts, and optional invisible-reasoning metadata. Truncated blocks open a complete-content `SearchablePreview`; that layer expands JSON and retains marker descriptions.
- `y` copies a category's complete entries in chronological order or the selected block's full raw text. Buffer/free have no copy payload.

## Preview Search and Clipboard

- `/` edits search in injection and complete-content previews. Search runs on rendered lines with ANSI stripped, not across wraps. Enter confirms; `n`/`N` moves next/previous with wrap-around after confirmation. Esc clears while editing; otherwise it goes back. Typing reveals the first match at/after the current top line, wrapping to the first if needed.
- Highlights preserve existing ANSI styles; a reserved status row shows current/total or “no matches”.
- `y` copies the preview's entire raw content, never highlighted/rendered lines. Clipboard support depends on Pi's terminal/host facility; empty content and failures display a notice instead of throwing from the view.

## Integration and Constraints

- Models: `../model.ts` supplies `InitialSnapshot`, `InjectionItem`, `ContextUsageSnapshot`, and `UsagePreviewEntry`; `../usage.ts` supplies chronological `collectPreviewEntries`.
- Shared modal: `ModalDialog`, `ModalTab`/`ModalLayer` input capture and mouse contracts, `ListNavigator`, `PreviewScroller`, `RenderCache`, layout helpers, and Vim scheme. Cached tab renders clear on navigation, filtering, percentage/zoom changes, or invalidation.
- Theme/host: Pi theme colors and pi-tui input, wrapping, width, and normalized mouse types. Clipboard access is isolated in `copy.ts`; the other UI modules do not invoke extension lifecycle APIs.
- Raw preview and injection text must not be logged or serialized. Terminal sanitization is for display only; clipboard targets use captured text with copy normalization.
