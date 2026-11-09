# Tasks

## 1. Configuration: `auto_probing`

- [x] 1.1 Add `auto_probing: z.boolean().default(true)` to the full and partial `context_view` schemas in `src/schemas/context-view.config.schema.ts`. Verify that `test/context-view/config-schema.test.ts` expects the new default and rejects non-boolean values.
- [x] 1.2 Regenerate `assets/config.schema.json` with `bun run buildSchema`. Verify that the generated `context_view` entry lists `auto_probing` with default `true`.
- [x] 1.3 Document `auto_probing` in the README config example and the `context_view` options table (README.md ~134-137, ~199-204). Verify by reading the rendered section.

## 2. Modal shell: input capture, mouse forwarding, transient notice

- [x] 2.1 Add optional `capturesInput?(): boolean` to the tab and layer contracts in `src/libs/modal/types.ts`. Route raw input to a capturing target before `Tab` handling and Vim scheme mapping in `ModalDialog.handleInput` (D5). Verify with modal tests that `Tab`, `j` and `q` reach a capturing layer or tab and do not switch tabs or close.
- [x] 2.2 Implement `ModalDialog.handleMouse(event)`, forwarding to the input target's optional `handleMouse` and returning its result (D6). Verify with a test that a wheel event reaches the top layer, falls back to the active tab, and returns `undefined` when no handler exists.
- [x] 2.3 Add `ModalDialog.showNotice(text, tone, ttlMs)`, rendered in place of the footer hint line, where the newest notice wins and expiry requests a render (D6). Verify with tests that the dialog height is unchanged with a notice, the notice expires, and a newer notice replaces an older one.
- [x] 2.4 Update `src/libs/modal/README.md` with the input-capture, mouse and notice contracts. Verify by running the existing model-select test suite unchanged: `bun test test/model-select`.

## 3. Capture correctness

- [x] 3.1 Add a shared `canPresent(ctx)` predicate (`ctx.mode === 'tui' && ctx.hasUI`). Use it in the command, the Vim event, the capture handlers and probe start (D2). Verify with registration/index-context tests that print/JSON-mode runs capture nothing and send no probe.
- [x] 3.2 Move `capture.finalize(...)` to an observe-only `context_with_system` handler that returns nothing, re-applies probe filtering to its local copy, and skips Pi's leading system-prompt message. Keep probe filtering on `context` (D1). Verify with capture tests that a system-role message added by another handler appears in the snapshot with tokens, and that the provider context is unchanged.
- [x] 3.3 Verify the silent probe still yields a frozen snapshot through `context_with_system` after the `turn_start` abort. Extend the probe/index-context tests to cover the full probe path and confirm that they pass.
- [x] 3.4 Exclude tools with `exposure === 'hidden'` or listed in `systemPromptOptions.hiddenTools` (missing counts as empty) from measured active tools in the capture path and the controller fallback (D12). Verify with measure/capture tests that hidden tools add no tokens and are not listed as active definitions.
- [x] 3.5 Key path-loaded extension sources (`local`, `auto`, `cli` with a path) by source plus path. Label them by the shortest unique path suffix, dropping a trailing `index.ts`/`index.js`. Package labels stay as they are. Apply the same keying to tool and prompt sources (D12). Verify with model/injections-model tests covering two same-kind path extensions, the index-file label, and a package source.
- [x] 3.6 Update `src/extensions/context-view/codemap.md` for the new capture flow, the hidden-tool rule and source keying, plus the README note that Context View requires Pi 0.87 or later. Verify by reading the updated docs.

## 4. Silent probe safety

- [x] 4.1 Implement `checkProbeStartConditions` in `context-view-controller.ts` with the D3 order. The checks are:
  - the `auto_probing` setting
  - idle wait
  - compaction
  - `hasPendingMessages()`
  - a selected model
  - a `VIRTUAL_MODEL_API` (`"pi-virtual"`) constant check
  - configured auth
  - a guarded settings block: idle cache warming, `shouldCompact` against `ctx.getContextUsage()`, and settings that cannot be read

  The attempt must be consumed only after every check passes. Verify with controller tests: one per failing condition, each with its degraded reason; a failed condition leaves the attempt available for a later opening; disabled `auto_probing` sends nothing.
- [x] 4.2 Restrict the input claim to `waiting` + `source === 'extension'` + `streamingBehavior === undefined` + token. Restrict the run claim to `messageType === 'user'` + token. Fail as `foreign-run` without aborting, and abort in `turn_start` only a claimed running probe (D4). Verify with tests that a custom-message run started during the probe is not aborted and the probe reports a degraded reason.
- [x] 4.3 Detect a second token-carrying input after the claim as `nested-send`: fail the attempt with the "empty probe prompt may reach the model" explanation and abort neither run. Verify with a fixture that sends a nested user message from a probe-scoped handler.
- [x] 4.4 Record only the claimed run's first user prompt and the exact setup-abort assistant. Drop or blank only identity matches whose content qualifies, for both live and persisted identities (D4). Verify with tests that a non-empty message sharing the probe timestamp survives live and after restoring persisted identities, while the empty prompt and the abort are still removed.

## 5. Mouse wheel

- [x] 5.1 Implement wheel handling through `handleMouse` in the Usage view, Injections view, Usage block stream and preview layers, moving by `event.wheelDelta` and returning `{ handled: true }`. Remove the `ui/wheel.ts` SGR/X10 parsing, `readWheelScrollLines`, and `WheelPreviewLayer` (D6). Verify by rewriting `test/context-view/wheel.test.ts` to drive normalized wheel events against each view and layer.
- [x] 5.2 Update `src/extensions/context-view/ui/codemap.md` for the wheel path. Verify by reading the updated doc.

## 6. Injections filter and stable height

- [x] 6.1 Create the pure `src/extensions/context-view/ui/search.ts`: whitespace-collapsed, escaped, case-insensitive pattern building plus range finding (D7). Verify with unit tests for metacharacters, case, whitespace collapsing and multiple matches.
- [x] 6.2 Add Name/Content filtering over the hierarchy in `injections-model.ts` (D8):
  - Name mode keeps the matching label's subtree.
  - Content mode matches preview text, including expanded JSON.
  - Both modes keep ancestors and report when nothing matches.

  Verify with injections-model tests for both modes, ancestor retention and an empty result.
- [x] 6.3 Wire the filter into `InjectionsView` (D8):
  - `/` opens the prompt, with `capturesInput()` true while editing.
  - `Tab`/`Shift+Tab` toggle the mode, Enter confirms, Esc clears.
  - A status row shows while the filter is applied.
  - Selection resets.
  - Add the `/` hint.

  Verify with injections-view tests covering typing `j`/`q` into the query, mode toggling, confirming and clearing.
- [x] 6.4 Make Injections rendering fill exactly the height it is given: remove the `?? rows.length + 10` fallback, reserve the filter row inside the fixed layout, and pad short lists. Verify with a test asserting identical rendered line counts across selection moves, filter on/off, and short or empty results.
- [x] 6.5 Document the `/` filter keys in the README Context View section. Verify by reading the section.

## 7. Preview search

- [x] 7.1 Add an ANSI-safe highlight helper that inserts match styling at visible-column offsets into styled lines. A line that fails to parse is left unhighlighted. Verify with unit tests on plain lines, styled lines, and lines with reset sequences.
- [x] 7.2 Implement the `SearchablePreview` wrapper (D9) for the contribution previews from `section-preview`, `skill-preview` and `json-preview`, and for the complete-content preview:
  - `/` starts editing, with `capturesInput()` true.
  - Typing jumps to the first match at or after the current top line.
  - Enter confirms; Esc clears.
  - `n`/`N` wrap around.
  - The reserved prompt row shows `current/total` or "no matches".
  - A width change re-runs the search.

  Verify with tests for match counting, wrap-around in both directions, no-match leaving the scroll position unchanged, constant height, and `/` staying unbound in the Usage block stream.
- [x] 7.3 Document the preview search keys in the README Context View section. Verify by reading the section.

## 8. Clipboard copy

- [x] 8.1 Create `src/extensions/context-view/ui/copy.ts`, with `copyText` taking an injectable clipboard function that defaults to Pi's `copyToClipboard`, plus text normalization and a mapping to notices through `showNotice` (D6, D10). Verify with unit tests for normalization, success (character count), empty input, and a throwing clipboard producing a failure notice.
- [x] 8.2 Bind `y` in the Injections list (item text; a group copies only its filter-visible items), Injections previews (full raw content), Usage category rows (chronological complete content; nothing for buffer and free rows), the Usage block stream (selected block), and the complete-content preview. Add `y` hints. Verify with view tests using a fake clipboard for each target, including a group under an active filter.
- [x] 8.3 Document `y` in the README Context View section, noting that clipboard availability depends on the terminal and host. Verify by reading the section.

## 9. Usage percentage basis

- [x] 9.1 Add `percentBasis` (`window` by default) to `UsageView`, toggled by `p` only when a positive denominator exists (D11). Category rows use the estimated total under `used`, buffer and free rows show no percentage, the legend heading names the basis, and the header stays window-based. Add the `p` hint. Verify with usage-view tests for both bases, the unavailable denominator, a reset on a new dialog, and retention across tab switches.
- [x] 9.2 Document `p` in the README Context View section. Verify by reading the section.

## 10. Integration and release

- [x] 10.1 Run `bun run lint`, `bun run type-check` and `bun test`. Verify that all three pass with no new warnings.
- [x] 10.2 Smoke-test in a real Pi 1.5 TUI session, in both inline and overlay layouts:
  - the probe on first open
  - a system-role message from a test extension in Injections
  - the filter, search, copy and `p`
  - wheel scrolling in fullscreen mode

  Record whether inline layout receives wheel events, which answers the design's open question. Verify that each item behaves as specified.
- [x] 10.3 Add a minor changeset describing the upstream v0.8.3 alignment, the new keys and `auto_probing`, and the Pi 0.87 minimum. Verify with `bunx changeset status`.
- [x] 10.4 Run `openspec validate context-view-v1-2 --strict`. Verify that the change is still valid after implementation-driven edits to the artifacts.

## Workflow follow-up

- Archive the change after review with `/opsx-archive`, which syncs the delta into `openspec/specs/context-view/spec.md`.
