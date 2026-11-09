# Design

## Context

The motivation is in proposal.md and the required behaviour is in `specs/context-view/spec.md`. The current state that shapes this design:

- **Capture** (`src/extensions/context-view/index.ts`, `capture.ts`):
  - `before_agent_start` calls `capture.prepare(...)`, then the first eligible plain `context` event calls `capture.finalize(...)`. The snapshot is frozen after that.
  - The system prompt comes from `ctx.getSystemPrompt()`.
  - `measureInjectedMessages` already measures `role === 'system'` messages (`capture.ts` ~531-557). That code never runs, because since Pi 0.87 the runner removes system messages before `context` handlers see them. The full list goes only to `context_with_system`, which runs after every `context` handler.
- **Probe** (`context-view-controller.ts` ~52-128, `capture.ts` ~228-360, `probe-token.ts`):
  - A token held in `AsyncLocalStorage` identifies the probe's `input`.
  - The only start gates are idle wait, compaction, a selected model and configured auth.
  - `recordMessage` records **every** user or assistant message while the probe is `running`. `filterMessages` and the persisted identities then drop any message whose `role:timestamp` matches, whatever its content.
  - `turn_start` calls `ctx.abort()` whenever `probe.isCurrentRun` is set. It doesn't check that the run's `messageType` is `user`.
- **Modal shell** (`src/libs/modal/modal-dialog.ts`):
  - `handleInput` handles `Tab`/`Shift+Tab` and Vim scheme actions **before** the top layer or tab sees the key.
  - `PreviewLayer` ignores raw keys.
  - The existing shell-level `filter` option cannot be combined with the Vim scheme (modal README) and isn't used by Context View.
  - There is no `handleMouse`.
- **Wheel**: `ui/wheel.ts` parses SGR/X10 bytes in `handleInput`. pi-tui 1.5 parses wheel reports itself in fullscreen mode, delivers them through `Component.handleMouse(event)` with `wheelDelta`, and consumes the raw bytes. So our parser never receives anything.
- **Host APIs** verified on the installed Pi 1.5.0:
  - Events and context: `context_with_system`, `ctx.hasUI`, `ctx.mode`, `ctx.hasPendingMessages()`, `ctx.getContextUsage()`.
  - Hooks and tools: `BeforeAgentStartEvent.messageType` (`user` | `custom`), `ToolInfo.exposure` (including `hidden`), `systemPromptOptions.hiddenTools`.
  - Settings: `SettingsManager#getCacheWarmingMode()` and `#getCompactionSettings(model)`.
  - Package exports: `shouldCompact` and `copyToClipboard` (which throws on failure). Virtual models have `model.api === "pi-virtual"`, but that discriminator isn't exported.
- **Upstream reference**: pi-context-view v0.8.3 (`60bfde29`) implements equivalent behaviour on a different capture model (latest request plus payload). We adapt its semantics and don't copy its structure.

## Goals / Non-Goals

**Goals:**
- Fix the capture and probe defects in place, keeping the frozen initial snapshot model and the existing module boundaries.
- Add one shared modal-shell mechanism for "a view temporarily owns the keyboard". Both the filter and preview search build on it.
- Keep every new interaction inside the existing half-height, tab-retained, layer-stacked modal model.

**Non-Goals:**
- Search inside the chronological Usage block stream. There, `/` stays unbound. Search is available in text previews, including the complete-content preview opened from a block.
- Matches that span wrapped preview lines. Search works on rendered lines.
- Promoting the search-capable preview layer into `src/libs/modal/`. It stays in Context View until a second consumer needs it.
- Supporting Pi versions older than 0.87.

## Decisions

### D1. Capture on `context_with_system` as an observer; keep probe filtering on `context`

`capture.finalize(...)` moves from the `context` handler to a new `context_with_system` handler. That handler **returns nothing**, so it never takes on the event's replace-the-list semantics or Pi's rule that the leading system message must stay. It re-applies `probe.filterMessages` to its local copy as a safeguard. When measuring, it skips Pi's leading system-prompt message, which `analyzeSystemPrompt` already measures, and treats any other system-role message as an observable addition.

The `context` handler keeps filtering probe messages out of the transcript list, so `context` handlers registered after ours don't see them.

- *Alternative: keep everything on `context`.* Rejected because system-role additions stay invisible.
- *Alternative: also filter on `context_with_system` by returning a list, as upstream does.* Rejected: we would have to preserve the leading system message ourselves, and `context` filtering already covers the transcript.
- *Consequence:* Pi 0.87 or later is required. On older Pi the event never fires, capture never freezes, and the view stays in its degraded fallback. This is documented, and no dual path is kept.

### D2. One "presentable" predicate gates the command, capture and probe

`canPresent(ctx) = ctx.mode === 'tui' && ctx.hasUI`. The command and Vim event already require TUI. Capture handlers (`before_agent_start` prepare, `context_with_system` finalize) and probe start now return early when the predicate is false.

- *Alternative: `hasUI` only, as upstream does.* Rejected: our view can only render in TUI mode, so capturing for RPC hosts is wasted work.

### D3. Probe start conditions are a single ordered check that returns a reason

`checkProbeStartConditions(ctx, deps)` in the controller returns either `ok` or a degraded reason string. The order is:

1. `auto_probing` setting
2. `waitForIdle`
3. compaction active
4. `hasPendingMessages()`
5. a model is selected
6. the model is not virtual (`model.api === VIRTUAL_MODEL_API`, a local constant with a test, because Pi doesn't export it)
7. configured auth
8. a settings block, inside `try`/`catch`:
   - `SettingsManager.create(cwd, …, { projectTrusted })`, as `settings.ts` already does
   - `getCacheWarmingMode() === 'idle'` blocks the probe
   - `shouldCompact(usage.tokens, usage.contextWindow, getCompactionSettings(model))`, with usage from `ctx.getContextUsage()`; unknown usage counts as below the threshold
   - a throw blocks the probe as "settings unreadable"

The probe attempt is consumed only after every check passes. This extends the existing compaction behaviour, so a failed check never uses up the attempt. The reason strings feed the existing degraded explanation.

### D4. Probe isolation is narrowed to explicit claims and content-qualified filtering

The probe moves through phases `idle → waiting → claimed → running → settled`. A failure can happen at any phase, with a reason of `foreign-run`, `nested-send`, `timeout` or `aborted`.

- **Input claim:** phase is `waiting`, `source === 'extension'`, `streamingBehavior === undefined`, and the token matches. A second token-carrying input after the claim fails the attempt as `nested-send`. Neither run is aborted.
- **Run claim** (`before_agent_start`): requires `messageType === 'user'` and the token. Any other run while `waiting` or `claimed` fails the attempt as `foreign-run` and is left to run.
- **Recording:** only the claimed run's **first** user message (the empty prompt) and an assistant message matching the exact setup-abort criteria are recorded. The blanket recording of every message during the run is removed.
- **Filtering and blanking:** a message is dropped or blanked only if its identity matches **and** its content qualifies: an empty user prompt, or an assistant with an error stop reason and the setup-abort message. Persisted identities use the same rule, which closes the same-millisecond collision after reload. The persisted entry format is unchanged.
- **Abort:** `turn_start` aborts only a run in the `running` phase that came from a successful run claim.

*Alternative:* port upstream's `silent-probe.ts`/`filter.ts` wholesale. Rejected because their state is shaped by the latest-request tracker. We keep our module layout and adopt their claim rules.

### D5. Modal shell: input capture contract

Add an optional `capturesInput?(): boolean` to the modal tab and layer contracts (`src/libs/modal/types.ts`). In `ModalDialog.handleInput`, before `Tab` handling and scheme mapping, the shell checks the input target (top layer, otherwise the active tab). If that target reports `capturesInput()`, the raw data goes straight to its `handleInput`. The footer shows the target's own hints while it captures input.

The text field is pi-tui's `Input`, which the shell's existing filter already uses.

- *Alternative: use the shell-level `filter` option.* Rejected: it is always visible, conflicts with the Vim scheme, and can't express a Name/Content mode toggled by `Tab`.
- *Alternative: handle input inside views without shell support.* Impossible, because the shell consumes `Tab`, `j`, `k`, `q` and so on first.
- *Consequence:* existing consumers (model selection) don't implement `capturesInput`, so their behaviour is unchanged. Their tests act as regression checks.

### D6. Modal shell: mouse forwarding and transient notice

- **Mouse:** `ModalDialog` implements `handleMouse(event)`. It forwards to the input target's optional `handleMouse` and returns its result. With no handler, it returns `undefined`.
- **Context View side:** the Usage, Injections, block-stream and preview layers handle wheel events (`type === 'wheel'`) by moving the scroll position or selection by `event.wheelDelta`. The host has already applied the user's scroll step and acceleration, so the views don't scale it. They return `{ handled: true }`.
- **Removed:** `ui/wheel.ts` SGR/X10 parsing, `readWheelScrollLines`, and the wheel-only `WheelPreviewLayer`.
- **Transient notice:** `ModalDialog.showNotice(text, tone, ttlMs)` renders a notice **in place of the footer hint line**, so the dialog height doesn't change. It uses a generation counter so only the newest notice survives, and a timer that requests a render when it expires.
  - Context View uses it for copy results: success for 3 s, empty or failure for 5 s.
  - *Alternative:* a notice row inside each view. Rejected because it complicates the stable-height rule and duplicates code across views.

### D7. Shared matching module `ui/search.ts`

A pure module builds a pattern and finds matches:
- whitespace runs in the query are collapsed and trimmed
- regex metacharacters are escaped
- matching is case-insensitive (`iu`)
- for content-mode filtering, the searched text's whitespace is collapsed too

It returns match ranges. The Injections filter (D8) and preview search (D9) both use it, so their semantics stay the same.

### D8. Injections filter and stable height

`InjectionsView` gains a filter state: query, mode (`name` | `content`), editing flag.

- **Keys:** `/` opens the prompt, `Tab`/`Shift+Tab` toggle the mode, Enter confirms, Esc clears. While editing, `capturesInput()` is true.
- **Model:** filtering is a pure function in `injections-model.ts` over the existing hierarchy.
  - Name mode keeps the matching label's whole subtree.
  - Content mode matches item text, using the same text the preview shows, including expanded JSON.
  - Both modes keep the ancestors of matches.
  - Selection moves to the first visible item, or is cleared when nothing matches.
- **Stable height:**
  - The view always renders exactly the height the dialog gives it. The `?? rows.length + 10` fallback is removed.
  - While the filter is being edited or is applied, one row is reserved for the prompt, or for a compact `Filter (Name): query` status line, and the list viewport shrinks by that row.
  - Short lists are padded.
  - The legend and scroll lines are counted in the fixed layout, not added conditionally.

### D9. Preview search as a Context View layer wrapper

A Context View `SearchablePreview` wraps the existing preview contents: the contribution previews from `section-preview`, `skill-preview` and `json-preview`, and the complete-content preview.

- **Matching:** it runs `search.ts` over the **rendered** lines with ANSI stripped, and keeps a list of `(line, start, end)` matches.
- **Highlighting:** applied by inserting SGR highlight sequences at visible-column offsets into the styled lines. The current match uses a distinct style. The helper is tested against already-styled input.
- **Prompt:** one reserved row showing the query and `current/total`, or "no matches". The preview area shrinks by that row, so the overall height is constant.
- **Keys:**
  - `/` starts editing (`capturesInput()` is true).
  - Typing jumps to the first match at or after the current top line.
  - Enter confirms.
  - Esc while editing clears the search.
  - `n`/`N` step through matches with wrap-around, and work only after the search is confirmed.
- **Re-wrapping:** a width change re-runs the search on the re-wrapped lines and keeps the current match index where possible.

### D10. Copy targets and clipboard adapter

`ui/copy.ts` exposes `copyText(text, clipboard = copyToClipboard)`. It normalizes line breaks, trims leading newlines and trailing whitespace, and maps the result to a notice through D6.

| Target | What is copied |
|---|---|
| Injections item | its raw captured text |
| Injections group | the text of the group's **filter-visible** items, joined with blank lines |
| Injections preview | the full item content (raw, not the rendered lines) |
| Usage category row | that category's entries' complete content in chronological order; buffer and free rows have nothing to copy |
| Usage block stream | the selected block's complete content |
| Complete-content preview | its content |

### D11. Percentage basis

`UsageView` holds `percentBasis: 'window' | 'used'`, which starts as `window` with each new dialog. `p` toggles it only when at least one basis has a positive denominator.

- `window` uses `reported.contextWindow`. `used` uses `ContextUsageSnapshot.estimatedTokens`, the sum of the estimated categories.
- Under `used`, only category rows get a percentage.
- The legend heading names the basis. The header's overall figure always uses the window.

This is separate from `z` (map scale).

### D12. Hidden tools and per-path extension sources

**Hidden tools:** the active tool set used for measurement excludes tools with `exposure === 'hidden'` or listed in `systemPromptOptions.hiddenTools` (missing counts as empty). This applies to both the capture path and the Pi-native fallback in the controller. Two signals are used because either can be absent depending on how the tool was registered.

**Sources:** `extensionSource` takes `(source, path)`.
- For `local`, `auto` and `cli` sources with a path, the id is `tool-source:${source}:${path}`.
- The label is computed once per snapshot over all path-loaded sources present. It is the shortest trailing path segment sequence that no other path-loaded source shares, with a trailing `index.ts`/`index.js` dropped. If nothing is unique, the full path is used.
- Package sources keep their current label.
- The same keying applies to prompt sources from `collectPromptSources`, so tool and prompt attribution agree.

### D13. `auto_probing` configuration

Add `auto_probing: z.boolean().default(true)` to the full and partial `context_view` schemas (`src/schemas/context-view.config.schema.ts`), regenerate `assets/config.schema.json` with `bun run buildSchema`, and read it at view-open time through `deps.config.getContextView()` (D3, step 1).

## Risks / Trade-offs

- **[Pi < 0.87 no longer captures]** → Document the minimum in README and the changeset. The development pin is already `^1.5.0`, and the fork already depends on post-0.84 behaviour.
- **[The probe abort may not reach `context_with_system`]** The abort happens at `turn_start`, and both context phases are emitted in one `emitContext` call, so capture should still fire. → An early task verifies it with the existing probe and capture tests before other work depends on it.
- **[The hard-coded `"pi-virtual"` string drifts]** → Keep it as a named constant with a test, and revisit if Pi exports it.
- **[Cache-warming mode read from merged settings]** Upstream found that a project override can hide the global value. Pi documents `cacheWarming` as global-only, so the merged read should reflect it. → Accepted; if it proves wrong, fall back to reading the global file.
- **[ANSI-safe highlighting breaks styling]** → Implement it as an isolated helper with tests for nested and reset sequences. Fall back to no highlight for a line that fails to parse.
- **[Wheel delivery for inline layout is unverified]** pi-tui dispatches wheel events to overlays and layout components in fullscreen mode, but whether an inline `ctx.ui.custom` component is hit-tested is untraced. → Covered by the "Host keeps wheel input" scenario. A smoke-test task checks both layouts.
- **[OSC-52 clipboard size limits]** `copyToClipboard` throws → this surfaces as the failure notice with Pi's message.
- **[Shell input capture misroutes keys]** → Only Context View targets implement `capturesInput`. Shell tests cover `Tab` going to a capturing target, and model selection's tests run unchanged.
- **[Search on rendered lines misses matches across line wraps]** → Accepted; listed in the non-goals.

## Migration Plan

- The configuration change is additive. `auto_probing` defaults to `true`, which keeps today's behaviour.
- No persisted data format changes. Probe identities keep their custom entry and shape. Only the filter rule is stricter, so older sessions reload safely.
- Release as a minor version through a changeset that notes the Pi 0.87 minimum and the new keys.
- Rollback means reverting the release. No state cleanup is needed.

## Open Questions

- Does pi-tui deliver wheel events to inline (non-overlay) custom components in fullscreen mode? The answer only affects whether the wheel works in inline layout. The spec already allows for both, so the design and tasks don't depend on it.
