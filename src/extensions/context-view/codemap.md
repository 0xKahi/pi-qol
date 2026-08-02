# src/extensions/context-view/

## Responsibility

Provides optional, TUI-only inspection of model-context occupancy and Initial-phase context injections. Disabled by default; lazily registered only after a session starts with `context_view` enabled. Two inspection surfaces are exposed:

- `/context-view` command (registered as `context-view`).
- `pi.vimKeys.event:pi-qol.context_view` Vim event (defined in `constants.ts` and `src/constants.ts`).

All captured prompt, tool, skill, context-file, and message content remains process-local and must never be logged or serialized. Only synthetic probe `role + timestamp` identities may be persisted.

## Architecture & Design Patterns

- **Pure semantic model / pure functions**: `model.ts`, `measure.ts`, `usage.ts`, `ui/injections-model.ts`, `ui/usage-map.ts`, `ui/layout.ts`, `ui/skill-preview.ts` contain no pi or TUI API access and are independently unit-testable.
- **State machines**: `InitialCaptureState` (capture-once) and `SilentProbeState` (single probe lifecycle) in `capture.ts` own explicit phases and transitions.
- **Controller / data preparation**: `context-view-controller.ts` isolates the command/UI data path from the event-driven capture path.
- **Stateful UI shell with stateful child tabs**: `ContextViewDialog` (shell) retains `UsageView` and `InjectionsView` instances; navigation is shared via `VimNavigation`.
- **Event-driven registration**: `index.ts` hooks into `ExtensionAPI` events and only performs work when `config.isEnabled('context_view')` returns true.
- **Sanitize-before-persist**: `SilentProbeState` records only `role` and `timestamp` for synthetic messages; raw content is discarded.

## Module Roles

### `model.ts` — Semantic model

Pure types shared by capture, measurement, and UI.

- `InjectionItem`, `InjectionGroup`, `InitialSnapshot`: Initial-phase context decomposition.
- `UsageCategory`, `UsagePreviewEntry`, `ContextUsageSnapshot`: Usage-view composition.
- `ReportedContextUsage`, `InvisibleReasoningEstimate`: pi-reported usage metadata and reasoning-token estimates.
- `groupInjections()` / `buildSnapshot()`: group items by source with deterministic ordering (pi-native first, then extensions by size, aggregate last); items are copied to prevent later mutation.

### `measure.ts` — Prompt/tool measurement

Pure measurement of the captured system prompt.

- `analyzeSystemPrompt()`: splits the rendered system prompt into `base-prompt`, `append-prompt`, `context-file`, `skills`, `tool`, `prompt-addition` items.
- `measureTools()`: per-tool definitions plus prompt snippets/guidelines carved from base prompt; built-in tools collapse into one aggregate pi-native item.
- `measureContextFiles()`: extracts `<project_instructions>` file content without XML scaffolding.
- `measureSkills()`: extracts `<available_skills>` section and each configured skill.
- `measureAppendedPrompt()`: identifies `--append-system-prompt` text.
- Uses a `Span` carving model to avoid double-counting base-prompt content; footer detection (`Current working directory: <cwd>`) separates pi base prompt from extension additions.

### `capture.ts` — Capture-once state + silent probe

Stateful capture and the single allowed silent probe.

- `InitialCaptureState`: owns `prepare()` (every `before_agent_start`) and `finalize()` (first eligible `context` event). `snapshot` is frozen after the first successful finalization; `promptOptions` is kept current for the controller fallback.
- `SilentProbeState`: manages the probe lifecycle (`idle → waiting → running → settled/failed`) and records synthetic message identities by `role + timestamp`. Restores persisted identities from `pi-context-view:probe-identities` custom session entries. Sanitizes aborted assistant messages into successful stop messages so the transcript does not show an operation-aborted row.
- `measureInjectedMessages()`: diff the live provider `messages` against the session-branch baseline to identify context-only messages and custom messages.
- `buildNativeSnapshot()`: view-local pi-native snapshot without freezing the main capture state.
- `mergeContextOnlyMessages()`: overlays context-only messages from a frozen Initial snapshot onto the current snapshot.

### `usage.ts` — Usage classification

Pure composition of the Usage view.

- `computeUsage()`: combines the frozen/captured snapshot with live filtered messages and reported usage into `ContextUsageSnapshot`.
- `classifyPromptCategories()`: maps snapshot items into System Prompt, System Tools, Custom Tools, MCP Tools, Memory (AGENTS.md), Skills.
- `classifyMessages()`: categorizes live messages into User Messages, Agent Text Messages, Agent Thinking Messages, Agent Tool Calls, Tool Output, Extension Messages, Compacted Data; handles invisible reasoning via `InvisibleReasoningEstimate` (provider-reported or signature-proxy).
- `collectPreviewEntries()`: flattens a category for chronological preview rendering.
- `toReportedUsage()`: converts pi's `ContextUsage` into the view model.

### `context-view-controller.ts` — Data preparation

Command/event data preparation and degraded native fallback.

- `prepareContextViewData()`: waits for the agent to be idle, triggers the silent probe if no Initial snapshot exists, builds a current native snapshot from `getSystemPromptOptions()` / `getSystemPrompt()`, merges context-only messages, and computes usage.
- Returns `ContextViewData` with `initial`, `usage`, and optional `degradedReason`.

### `index.ts` — Registration, lifecycle, persistence

Wires the extension into `ExtensionAPI`.

- `registerContextView()`: lazy registration on the first enabled `session_start`.
- `activateContextView()`: installs event handlers, restores/persists probe identities, and registers the command and Vim event.
- Event handlers:
  - `session_start`: tracks latest context, restores probe identities.
  - `input`: observes empty extension inputs for the probe.
  - `before_agent_start`: begins probe run, prepares capture options.
  - `turn_start`: aborts real turn when the probe owns the run.
  - `message_start`: records probe message identities.
  - `message_end`: sanitizes aborted probe assistant messages.
  - `context`: filters probe messages, finalizes the Initial snapshot.
  - `agent_settled`: settles probe and persists new identities.
  - `session_shutdown`: fails probe and persists identities.
- Command handler validates enabled flag, no arguments, and TUI mode before opening the dialog.
- Vim event handler opens the dialog from the latest context.

### `constants.ts`

- `COMMAND_NAME = 'context-view'`.
- `PI_VIM_KEY_EVENT_ID`: shared Vim event id helper.

## UI Roles

### `ui/context-view-dialog.ts`

Bounded half-height inline shell.

- `ContextViewDialog`: implements `Component` and `Focusable`; renders the active tab line and delegates to `UsageView`/`InjectionsView`.
- `Tab`/`Shift+Tab` switches between `usage` and `injections`; both child view instances are retained so each preserves its scroll/selection state.
- `VimNavigation` handles `j/k`, arrows, `Ctrl+u/d`, `gg/G` before passing unhandled input to the active child.
- Height is bounded to `floor(terminal.rows / 2) - 1`.

### `ui/usage-view.ts`

Stateful Usage tab.

- Renders a proportional 14×14 context-window map (`UsageMap`), category legend, reported/estimated summary, and optional preview.
- Map scale toggles between `window` (reported context window) and `fit` (115% headroom, rounded to 2 significant digits) with `z` when applicable.
- Preview mode (Enter) shows chronological content entries for the selected category; supports scrolling, paging, and bounds.
- Handles invisible-reasoning metadata display in Agent Thinking Messages.
- Caches rendered output per (width, terminal rows) and invalidates on theme/selection/scroll changes.

### `ui/injections-view.ts`

Stateful Injections tab.

- Renders the hierarchical Initial snapshot: groups (source), items, sub-items (children), and a non-selectable TOTAL row.
- Preview mode (Enter) shows the raw text of the selected injection item.
- Tree rendering uses `├─`/`└─`/`│` prefixes and a stable shared value column.
- Currently only the `[INITIAL]` tab is rendered; `[Runtime]` is intentionally hidden until implemented.

### `ui/injections-model.ts`

Pure presentation model for Injections.

- `InjectionRow`: flattened row types (`group`, `item`, `separator`, `total`).
- `buildInjectionRows()`: flattens `InitialSnapshot` into rows.
- `collectItemsById()`: indexes items (including children) for preview lookup.
- `normalizePreviewText()` / `normalizeInlineText()`: sanitize terminal escape sequences and collapse whitespace.
- `ListNavigator`: selection/scroll-window state with selectable vs non-selectable rows.
- `PreviewScroller`: scroll-only window over wrapped preview lines.

### `ui/usage-map.ts`

Pure 14×14 proportional map model.

- `buildUsageMap()`: assigns cells to categories by largest overlap; fills `full`, `partial`, `buffer`, or `free`.
- `calculateFitMapScale()`: computes a Fit denominator with 115% headroom, capped at the reported context window and floored at 10,000 tokens.

### `ui/navigation.ts`

Shared Vim navigation parser.

- `VimNavigation.consume()` maps `j/k`, arrows, `Ctrl+u/d`, `gg`, `G` into `NavigationAction`.
- `PageUp`/`PageDown`/`Home`/`End` are intentionally ignored (handled as consumed but no action).
- Keeps a `pendingG` flag for the `gg` chord.

### `ui/layout.ts`

Shared layout utilities.

- `calculateViewport()`, `fitToTerminalHeight()`, `fitLine()`, `spreadLine()`, `hintRow()`, `wrapDescriptionLines()`.
- `STEP_KEY_HINT = '↑↓/jk'`.
- `BODY_INDENT = '  '`.

### `ui/skill-preview.ts`

Preview-only recognition of pi `<skill name="...">` wrappers.

- `splitSkillPreview()`: splits user-message text into `text` and `skill` segments so the UI can render compact skill badges.

## Data Flow

1. `registerContextView()` waits for the first enabled `session_start`, then calls `activateContextView()`.
2. `activateContextView()` restores any persisted probe identities from custom session entries.
3. On `before_agent_start`, `capture.prepare()` saves owned prompt options; `probe.beginRun()` checks whether the empty input is an extension-originated probe.
4. On `context`, `probe.filterMessages()` removes synthetic probe messages; the remaining messages are diffed against the session baseline to identify context-only injections; `capture.finalize()` freezes the Initial snapshot.
5. On `agent_settled`, the probe is settled and new identities are persisted to `pi-context-view:probe-identities`.
6. When the user invokes `/context-view` or the Vim event, `prepareContextViewData()`:
   - waits for agent idle;
   - triggers a silent probe if no Initial snapshot exists;
   - builds a current native snapshot from live prompt/tool data;
   - merges context-only messages from the fallback snapshot;
   - computes the usage snapshot and opens `ContextViewDialog`.
7. `ContextViewDialog` opens on the Usage tab, bounded to half terminal height, and routes input to the active tab while retaining both tab states.

## State Transitions

### InitialCaptureState

- `prepare(options)` → stores `latestOptions` and `pendingPreparation` (only until snapshot frozen).
- `finalize(input)` → if `initialSnapshot` is undefined, builds and freezes it; subsequent calls return the same snapshot.

### SilentProbeState

- `start()` → `idle → waiting`; creates a timeout; returns the existing completion on re-entry.
- `observeInput(extension, '')` → sets `inputObserved`.
- `beginRun('')` with `inputObserved` → `waiting → running` (or `*-after-timeout` if timeout already fired).
- `recordMessage()` / `sanitizeAssistant()` → records identities and replaces aborted assistant messages.
- `settle(captured)` → `running → settled`.
- `fail(reason)` → any pending phase → `failed`.
- Identities are persisted only after settlement or shutdown.

### ContextViewDialog

- `usage ↔ injections` via `Tab`/`Shift+Tab`.
- Active child handles selection, preview open/close, and scroll.
- Preview closes with `Esc`/`q`; dialog closes with `Esc`/`q` at the list level.

## Integration Points

- **Config**: `config-loader.isEnabled('context_view')` gates activation and command use.
- **ExtensionAPI**: `pi.on(...)`, `pi.registerCommand(...)`, `pi.events.on(...)`, `pi.appendEntry(...)`, `pi.getAllTools()`, `pi.getActiveTools()`, `pi.sendUserMessage('')`.
- **ExtensionContext**: `ctx.ui.custom<void>()`, `ctx.ui.notify()`, `ctx.abort()`, `ctx.getSystemPrompt()`, `ctx.getSystemPromptOptions()`, `ctx.getContextUsage()`, `ctx.waitForIdle()`, `ctx.mode`, `ctx.model`, `ctx.modelRegistry.hasConfiguredAuth()`, `ctx.sessionManager.getEntries()`, `ctx.sessionManager.getLeafId()`.
- **TUI**: `TUI`, `Theme`, `KeybindingsManager`, `Component`, `Focusable`, `Key`, `matchesKey`, `truncateToWidth`, `visibleWidth`, `wrapTextWithAnsi`.
- **Pi constants**: `piVimKeyEventId()` from `src/constants.ts`.
- **Custom session entry**: `pi-context-view:probe-identities` for cross-runtime identity persistence.

## Child Map

- See [`ui/codemap.md`](ui/codemap.md) for a detailed map of the Usage and Injections view internals, navigation, and rendering utilities.

## Constraints

- Captured prompt, tool, skill, context-file, and message content stays process-local and must never be logged or serialized.
- Only synthetic probe `role + timestamp` identities may be persisted.
- The silent probe is limited to one attempt per session; it aborts the real turn and cleans up the transcript.
- The view requires TUI mode; it warns in non-TUI modes.
- The command accepts no arguments.
- `PageUp`/`PageDown`/`Home`/`End` are intentionally replaced by Vim bindings.
