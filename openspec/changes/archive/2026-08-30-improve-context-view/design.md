## Context

See `proposal.md` for motivation. pi-qol forked pi-context-view before upstream v0.4.3 and subsequently moved the feature into a unified Usage/Injections dialog backed by the shared modal library. The fork also added optional inline/overlay presentation, retained tab and layer state, Vim navigation, feature gating, and a controller separated from lifecycle capture.

The upstream comparison baseline for this change is pi-context-view **v0.4.3**, `develop` commit `fefb71efc88bab5b959053dd023825d514f39946`. Future comparisons should diff from this immutable commit rather than from a moving branch. Ports will be semantic adaptations because file organization, formatting, commands, and presentation architecture have diverged. The implementation requires Pi **0.84.3 or newer within the 0.84 release line**, whose lifecycle API guarantees `session_compact_failed` for unsuccessful compactions.

Context View must keep captured prompt/message content process-local. Only synthetic probe role-and-timestamp identities may be persisted.

## Goals / Non-Goals

**Goals:**

- Port applicable upstream v0.4.3 correctness and measurement fixes without regressing fork-specific behavior.
- Make a long Usage category preview navigable by semantic entry and make all truncated content reachable.
- Preserve half-height rendering, both modal layouts, Vim semantics, tab switching with open previews, and per-tab retained state.
- Keep measurement and navigation geometry pure and independently testable.
- Avoid repeated O(session) Initial-capture preparation after the snapshot freezes.

**Non-Goals:**

- Replacing `/context-view` with upstream's `/context usage|injections` command grammar.
- Replacing the shared modal shell with upstream's standalone UI plumbing.
- Adding mouse-wheel navigation or configurable category colors.
- Persisting capture content or changing Context View's disabled-by-default configuration.
- Synchronizing every upstream commit mechanically.

## Decisions

### 1. Treat v0.4.3 commit `fefb71e` as the semantic port baseline

Each adopted behavior will be traced to the upstream commit and re-expressed in pi-qol's architecture. Source attribution headers remain intact where upstream-derived code is copied substantially.

**Why:** A package version alone is not immutable in this checkout because the current repository's Git tags do not identify v0.4.3. The full commit hash is unambiguous and makes a future `fefb71e..<new-ref>` review straightforward.

**Alternative considered:** Create a local Git tag in the upstream repository. Rejected because proposal capture should not mutate the upstream checkout and the commit hash already provides an immutable reference.

### 2. Gate probe creation with an explicit compaction lifecycle state

Add a small capture-domain state object that begins on `session_before_compact` and clears on `session_compact`, `session_compact_failed`, signal abort, session start, or shutdown. Require Pi 0.84.3 so every observed compaction settles through exactly one of the success/failure lifecycle events. The controller receives this state and checks it after waiting for agent idle but before calling the probe's one-shot `start()`.

When compaction is active, data preparation immediately builds the current Pi-native fallback and reports a degraded reason. It does not consume the sole probe attempt, allowing a later view opening to retry after compaction.

**Why:** Folding this into `SilentProbeState` would conflate two independent lifecycles. Starting and then failing a probe would incorrectly consume the session's single allowed attempt.

### 3. Recognize both legacy and stream-setup probe aborts narrowly

Probe assistant sanitization accepts either `stopReason: 'aborted'` or Pi 0.84's exact `stopReason: 'error'` plus `errorMessage: 'This operation was aborted'`. It still requires the current run to be probe-owned and the assistant identity to have been observed before replacing the result with empty successful content.

**Why:** Matching every error during a probe could hide genuine provider failures. Exact matching restores compatibility without weakening error visibility.

### 4. Read the effective auto-compaction reserve at view-open time

Use Pi's settings manager with the current working directory and project-trust state. Return the configured reserve only when compaction is enabled; catch settings failures and omit the buffer rather than failing the view. Pass the value through the controller to `computeUsage()`.

**Why:** The setting can differ by project and enabled state can change during a session. Reading at view-open time reflects the same merged settings Pi currently uses. The existing usage/map model already clips the reserve to remaining context capacity.

### 5. Separate latest prompt options from lazy Initial finalization

Keep copying the latest prompt options on every `before_agent_start` because the controller uses them for current Pi-native fallback construction. Change Initial finalization to accept a lazy input builder, or guard its expensive builder before collecting the session baseline, system prompt, and tool lists. The builder executes only while an Initial preparation exists and no snapshot has frozen.

The `context` event must continue filtering known synthetic messages and returning a replacement message list when needed, even after Initial freezes.

**Why:** Upstream's complete post-freeze `prepare()` no-op cannot be copied directly because pi-qol deliberately retains current prompt options. The expensive Initial-only path can still be eliminated independently.

### 6. Use claimed prompt regions and cumulative section token allocation

Port upstream's prompt-carving model for the rendered Available Tools and Guidelines bullet regions. Process active tools deterministically, seed the claim set with Pi-owned guideline text, and let the first eligible tool claim each distinct rendered guideline. A carved prompt line is appended to the global carved-span set exactly once.

Represent a measured tool with optional labeled sections such as Prompt Snippet, Guidelines, and Definition. The item's raw text is the exact section concatenation. Allocate section tokens using differences between cumulative character estimates so section totals equal the parent estimate despite rounding.

Carry sections into Usage preview entries and defensive snapshot copies. Use one section-body renderer from both Usage and Injections to keep labeling, wrapping, sanitization, and token presentation consistent.

**Why:** Independently estimating each section can create rounding drift, and first-match carving without ownership can double-count shared lines or let extension tools claim Pi-owned prompt content.

### 7. Keep map-cell scale as derived presentation data

Expose `blockTokens` from the pure usage-map result as the active scale divided by the fixed cell count. Render its rounded token value and `1 / cellCount` percentage in the responsive map key. Hide this detail whenever the map itself is unavailable.

**Why:** The value changes with Window/Fit zoom and therefore belongs to the map model, not the usage snapshot.

### 8. Add a Usage-specific selectable block layer without changing the generic modal contract

Add a pure `BlockNavigator` and preview layout model under Context View UI, adapted from upstream. A Usage category preview becomes a Context View-owned `ModalLayer` containing chronological entry blocks. It receives semantic navigation actions from the unchanged modal shell:

```text
Usage tab
    |
    | confirm category
    v
Usage block-stream layer
    |
    | confirm truncated block
    v
Generic full-content PreviewLayer
```

The block-stream layer invokes a callback captured from the Usage tab's existing `ModalTabContext`; that callback pushes a normal `PreviewLayer` for the selected entry. The shared shell therefore continues to own layer stacks and dismissal ordering without exposing a layer context or adding nested-layer APIs.

Blocks contain an entry header and a terminal-height-aware excerpt. Excerpts are capped to keep multiple entries browsable in the half-height dialog, with a visible hidden-line count. Navigation selects blocks; only an excerpt taller than the viewport temporarily scrolls line by line before selection crosses its edge. Confirm is a no-op for complete blocks and pushes the full-content layer for truncated blocks.

The full-content layer renders uncapped, sanitized content and optional section labels through the existing scroll behavior. Dismissing it reveals the still-mounted block layer with selection and offset intact. Because each tab already retains its layer stack, switching to Injections and back also restores both levels.

**Why:** Generalizing `PreviewLayer` into a selectable tree would complicate all modal consumers. A Usage-specific layer reuses stable shell semantics while containing upstream's specialized geometry.

**Alternatives considered:**

- Keep the flat preview and merely raise/remove its line cap. Rejected because large entries dominate navigation and uncapped streams are unwieldy in a half-height modal.
- Replace `PreviewLayer` globally with a block-aware component. Rejected because model-select and Injections do not need entry-block semantics.
- Render full content in place instead of pushing a layer. Rejected because a nested layer naturally preserves the selected block and matches existing dismissal behavior.

## Risks / Trade-offs

- **[Risk] Half-height dialogs may show only one useful block on very short terminals.** -> Derive excerpt caps from available content height with a small lower bound, and keep category/header/help regions bounded.
- **[Risk] Width or height changes can leave cached block geometry stale.** -> Key rendered block streams by wrap width and excerpt cap, redeclare navigator extents every render, and clear full-content caches on size or theme changes.
- **[Risk] A compaction event sequence is interrupted.** -> Also clear state on abort signal, session start, settlement/shutdown where safe, and cover failed compaction explicitly.
- **[Risk] Exact abort-message matching changes in a later Pi release.** -> Keep compatibility cases isolated and tested; future upstream comparisons start from the recorded baseline.
- **[Risk] Section token estimates disagree with the parent because of rounding.** -> Allocate via cumulative deltas and assert exact sums.
- **[Risk] Reading settings adds failure modes.** -> Catch all settings-read failures and degrade only the optional buffer display.
- **[Trade-off] Block selection makes `j`/`k` less literally line-oriented in category previews.** -> Preserve line scrolling inside oversized excerpts and full-content layers, and label the preview hint as entry navigation.

## Migration Plan

1. Introduce pure capture/measurement/model changes and compatibility tests without changing the visible preview flow.
2. Wire settings-derived reserve and map block-size presentation.
3. Add the pure block layout/navigator and its geometry tests.
4. Replace the Usage category preview with the block-stream layer and nested full-content layer.
5. Run Context View, modal self-containment, type-check, and lint suites; manually verify inline and overlay layouts at narrow and short terminal sizes.
6. Roll back by reverting the change as one feature update; no persisted schema or user configuration migration is required.
