## 1. Capture Correctness and Lifecycle

- [x] 1.1 Add the explicit compaction lifecycle state with begin/finish/abort handling and verify focused capture-state tests cover successful, failed, aborted, and already-aborted compactions.
- [x] 1.2 Register compaction lifecycle events and gate silent-probe creation before consuming the one-shot attempt; verify controller and registration tests cover degraded fallback during compaction and a successful later attempt.
- [x] 1.3 Recognize Pi 0.84 stream-setup abort errors in probe assistant sanitization while retaining exact probe ownership checks; verify capture tests cover legacy aborts, the exact setup-abort error, and unrelated provider errors.
- [x] 1.4 Make frozen Initial finalization collect its system prompt, session baseline, and tools lazily while continuing to retain current prompt options and filter synthetic messages; verify tests prove the expensive builder is not called after freeze and current fallback options still refresh.
- [x] 1.5 Require aligned Pi 0.84.3 host dependencies for guaranteed failed-compaction settlement and verify the refreshed lockfile, lifecycle typings, and registration tests.

## 2. Tool Measurement and Sectioned Previews

- [x] 2.1 Extend the process-local semantic model with labeled tool sections, exact cumulative token allocation, defensive copying, and Usage-entry propagation; verify model and usage tests assert section text/order and exact parent-token sums.
- [x] 2.2 Replace independent first-match tool prompt carving with scoped claimed regions and Pi-owned guideline precedence; verify measurement tests cover repeated guidelines, built-in/extension ownership conflicts, active-tool ordering, and absence of double-counting.
- [x] 2.3 Add a shared section-body renderer for Context View and use it in both Injections item previews and Usage entry content; verify UI tests cover labeled Prompt Snippet, Guidelines, and Definition sections plus the unsectioned fallback.

## 3. Usage Accounting and Map Detail

- [x] 3.1 Read the effective trusted project/global auto-compaction reserve at view-open time and pass it into Usage computation, degrading settings failures to an omitted buffer; verify controller tests cover enabled, disabled, unreadable, and context-capacity-clipped reserve cases.
- [x] 3.2 Expose the active map scale's tokens-per-cell value and render its token and percentage share responsively; verify usage-map and Usage-view tests cover Window/Fit scales, narrow layouts, and map-unavailable cases.

## 4. Block-Aware Usage Preview

- [x] 4.1 Add the pure chronological block layout and navigator model adapted from the recorded upstream baseline; verify unit tests cover block stepping, minimal reveal, oversized excerpts, paging, first/last bounds, empty streams, and geometry changes.
- [x] 4.2 Implement the Usage-specific block-stream modal layer with entry headers, terminal-height-aware excerpts, selection gutter, hidden-line markers, sectioned content, and semantic navigation; verify focused rendering/input tests cover multiple entries, complete and truncated blocks, short terminals, and width changes.
- [x] 4.3 Push an uncapped generic full-content preview layer when Enter confirms a truncated block, while making Enter a no-op for complete blocks; verify modal integration tests cover nested push/pop ordering, complete content scrolling, and restoration of the same selected block.
- [x] 4.4 Replace the existing flat Usage category preview with the block-stream layer and verify dialog tests preserve Tab/Shift+Tab switching, per-tab layer stacks, Vim hints/actions, inline/overlay framing, and half-height bounds.

## 5. Integration Verification

- [x] 5.1 Run the Context View and shared modal test suites and resolve regressions while preserving the modal library's self-containment audit.
- [x] 5.2 Run `bun run type-check` and `bun run lint` and confirm both complete successfully.
- [x] 5.3 Manually exercise `/context-view` in inline and overlay layouts before a first turn, during/after compaction, and with long tool/message content; verify the silent probe remains invisible, Usage shows the effective buffer and map block size, and nested block previews retain state.
