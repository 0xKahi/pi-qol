# src/extensions/context-view/

## Responsibility

Provides optional, TUI-only inspection of model-context occupancy and Initial-phase context injections. Disabled by default; lazily registered only after a session starts with `context_view` enabled. The interface defaults to inline presentation and can be configured as a centered overlay. Two inspection surfaces are exposed:

- `/context-view` command (registered as `context-view`).
- `pi.vimKeys.event:pi-qol.context_view` Vim event (defined in `constants.ts` and `src/constants.ts`).

All captured prompt, tool, skill, context-file, and message content remains process-local and must never be logged or serialized. Only synthetic probe `role + timestamp` identities may be persisted.

## Architecture & Design Patterns

- **Pure semantic model / pure functions**: `model.ts`, `measure.ts`, `prompt-blocks.ts`, `prompt-additions.ts`, `usage.ts`, `ui/injections-model.ts`, `ui/usage-map.ts`, `ui/skill-preview.ts`, `ui/json-preview.ts`, and `ui/markers.ts` contain no pi or TUI API access and are independently unit-testable.
- **Process-local replay**: `transcript.ts` replays Pi 0.86 system messages (content appends, named section patches, tool add/remove deltas) into a `SystemState` so Usage measures the current branch's prompt and tools rather than today's loader metadata.
- **State machines**: `InitialCaptureState` (capture-once), `SilentProbeState` (single probe lifecycle), and `CompactionState` (compaction-active guard) in `capture.ts` own explicit phases and transitions.
- **Causal probe correlation**: `probe-token.ts` carries an `AsyncLocalStorage` token through this extension's own `sendUserMessage()` call, so lifecycle handlers recognize the probe run by causality instead of prompt text another extension may rewrite.
- **Controller / data preparation**: `context-view-controller.ts` isolates the command/UI data path from the event-driven capture path.
- **Stateful UI shell with stateful child tabs**: `ContextViewDialog` (shell) retains `UsageView` and `InjectionsView` instances; navigation is shared via `VimNavigation`. The shared modal presenter coordinates its semantic layout with the shell frame and host mounting.
- **Sanitize-before-persist**: `SilentProbeState` records only `role` and `timestamp` for synthetic messages; raw content is discarded. `text.ts` sanitizes every external string before it reaches the terminal.
- **Event-driven registration**: `index.ts` hooks into `ExtensionAPI` events and only performs work when `config.isEnabled('context_view')` returns true.

## Module Roles

### `model.ts` — Semantic model

Pure types shared by capture, measurement, and UI.

- Shared constants: `PI_SOURCE_ID`, `AGGREGATE_SOURCE_ID`, `PI_SOURCE`, `AGGREGATE_SOURCE` (label `unattributed`), `extensionSource()`, and the presentation labels `SYSTEM_PROMPT_LABEL`, `INSTRUCTION_FILES_LABEL`, `SKILLS_LABEL`, `BUILT_IN_TOOLS_LABEL`.
- Injection types: `InjectionItem`, `InjectionGroup`, `InitialSnapshot`, `InjectionSource`, `InjectionKind`, `InjectionPhase`, `CaptureOrigin`.
- Prompt-structure types: `TextSpan`, `JsonSpan`, `InjectedReference`, `InjectionSection`; items carry optional `sections`, `children`, `dropped`, `moved`, `jsonSpan`, `injectedReferences`, `requestOnly`, and `systemMessage` (`{ message: SystemMessage; index }`).
- Usage types: `UsageCategory`, `UsagePreviewEntry`, `ContextUsageSnapshot`, `ReportedContextUsage`, `InvisibleReasoningEstimate`.
- `groupInjections()` / `buildSnapshot()`: group items by source with deterministic ordering (pi-native first, then extensions by size, aggregate last); items are copied to prevent later mutation.

### `transcript.ts` — System-message replay

Pure replay of Pi 0.86 transcript-backed system state.

- `SystemMessage` (Pi's system-message shape), `SystemState` (`content`, `sections`, `tools`).
- `replaySystemMessages()`: content appends, sections patch by name (`null` deletes), removals precede additions, and replacing a name preserves insertion order; returns `undefined` for a legacy/empty transcript (not an explicitly empty state).
- `systemMessageText()`: content followed by non-deleted sections, matching Pi's complete-prompt rendering.
- `copySystemMessage()`: owned deep copy used when freezing request-only system patches.

### `text.ts` — Terminal sanitizers

- `normalizePreviewText()`: normalize line endings/tabs and strip terminal strings, CSI/escape sequences, and control characters.
- `normalizeInlineText()`: preview text collapsed to one line.

### `measure.ts` — Prompt/tool measurement

Pure measurement of the captured system prompt.

- `analyzeSystemPrompt(prompt, options, tools?, additions?)`: dual parser. Pi 0.86 XML sections are located by `prompt-blocks.ts`; generated records (`project_context`, `skills`) are split into semantic items unless overridden via `options.sections`, and unknown/overridden sections stay visible as System Prompt parts. The legacy 0.80–0.85 structural parser recognizes `<project_instructions>`, the skills block, tool bullet blocks, the block headers, and the CWD/date footer.
- `PromptOptionsSlice` (`cwd`, `homeDir`, `customPrompt`, `appendSystemPrompt`, `sections`, `contextFilePaths`, `skills`) and `ToolSlice` (`name`, `description`, `parametersJson`, `snippet`, `guidelines`, `source`).
- Builds the System Prompt item from labeled parts (Preamble, Available Tools, Guidelines, Documentation, Appended Prompt, Current Dir, Extension Additions), marks `dropped` parts a `--system-prompt` replacement suppressed and `moved` parts an extension relocated, attaches preview-only `injectedReferences` with exact offsets, marks JSON runs, and reconciles section/child token shares exactly.
- `measureTools()`: per-tool definition payloads plus prompt snippets/guidelines carved from pi's blocks; built-in tools collapse into one aggregate pi-native item.
- `measureContextFiles()`, `measureSkills()`, `measurePromptAdditions()`: Instruction Files and Skills aggregates plus owner-attributed additions.
- `textTokens()`: chars/4 heuristic matching pi's text estimate.

### `prompt-blocks.ts` — Prompt block and section locator

- `findPromptSections()`: locate Pi 0.86 top-level XML sections in rendered order, skipping whole sections and fenced examples.
- `findSectionToolBlocks()`: locate native `tools`/`rules` surfaces with bounded, consecutive bullet regions and positional (`moved`) markers.
- `findPromptBlocks()`: recover block headers and bullet regions independently of order, preferring the pre-footer occurrence and requiring exact active-tool snippet/guideline evidence before claiming a relocated block.
- Constants `AVAILABLE_TOOLS_BLOCK`, `GUIDELINES_BLOCK`, `DOCUMENTATION_BLOCK`, `BASE_PROMPT_BLOCKS`; types `PromptSection`, `LocatedPromptBlock`, `PromptBlockTool`.

### `prompt-additions.ts` — Addition attribution

Pure, deliberately heuristic attribution of text after pi's prompt footer.

- `splitPromptAdditions()`: bound blank-line blocks at this extension's handler position (`promptAtHandler`), keep recovered-block `excluded` spans separate, and guess an owner only on a unique package-name, path, or registered tool/command match; everything else is `unattributed`.
- `PromptSourceSlice` (public provenance only), `PromptAdditionOptions`, `PromptAdditionRun` (`text`, `source`, `tool`, `attribution: 'guess'`).

### `capture.ts` — Capture state, compaction, and silent probe

Stateful capture, compaction tracking, and the single allowed silent probe.

- `InitialCaptureState`: `prepare()` (every `before_agent_start`, owning structured options and the handler-bounded prompt) and `finalize()` (first eligible `context` event). `snapshot` is frozen after the first successful finalization; `promptOptions` stays current for the controller fallback.
- `CompactionState`: tracks `session_before_compact` until success/abort/settlement, gating whether a silent probe is safe.
- `SilentProbeState`: owns the probe lifecycle (`idle → waiting → running → settled`), the correlation token, timeout, and exact synthetic `role + timestamp` identities. Restores persisted identities from `pi-context-view:probe-identities` custom session entries; sanitizes probe prompt/abort messages so the transcript shows no operation-aborted row.
- `parsePersistedIdentities()`: defensive parse of persisted probe identities.
- `buildNativeSnapshot()`: view-local pi-native snapshot without freezing the main capture state.
- `buildUsageSnapshot()`: replays the branch's system messages plus frozen request-only system patches to measure the current prompt/tools.
- `mergeRequestOnlyMessages()`: overlays frozen non-system request-only messages onto a current snapshot.
- `copyPromptOptions()`, `collectPromptSources()`, `captureActiveTools()`, `measureInjectedMessages()`.

### `usage.ts` — Usage classification

Pure composition of the Usage view.

- `computeUsage()`: combines the caller's current-state snapshot with live filtered messages and reported usage into `ContextUsageSnapshot`.
- `classifyPromptCategories()`: maps snapshot items into pi-qol's stable categories and order — System Prompt, System Tools, Custom Tools, MCP Tools, Memory (AGENTS.md), Skills — and returns prompt additions as per-owner categories.
- `classifyMessages()`: categorizes live messages and frozen request-only injections into User Messages, Agent Text Messages, Agent Thinking Messages, Agent Tool Call Messages, Tool Output (including Bash Executions), Extensions, and Compacted Data; handles invisible reasoning via `InvisibleReasoningEstimate` (provider-reported or signature-proxy).
- `collectPreviewEntries()`: flattens a category for chronological preview rendering.
- `toReportedUsage()`: converts pi's `ContextUsage` into the view model.

### `settings.ts` — Compaction settings

- `readAutoCompactReserveTokens()`: read pi's merged `SettingsManager` compaction reserve (or `undefined` when disabled/unreadable) for the Usage map's buffer.
- `resolveAutoCompactReserveTokens()`: resolve a model's `compaction.modelOverrides` entry, else the ordinary reserve, else pi's default.
- `CompactionModel` (`provider`, `id`).

### `probe-token.ts` — Probe correlation token

- `createProbeToken()`, `runWithProbeToken()`, `readProbeToken()`: an opaque, process-local token carried by `AsyncLocalStorage` through the probe's own `sendUserMessage()` async context.

### `context-view-controller.ts` — Data preparation

Command/event data preparation and degraded native fallback.

- `prepareContextViewData()`: waits for the agent to be idle, triggers the silent probe if no Initial snapshot exists, builds a current branch snapshot from `getSystemPromptOptions()` / `getSystemPrompt()` (replaying transcript state and merging request-only messages), reads the compaction reserve, and computes usage.
- Returns `ContextViewData` with `initial`, `usage`, and optional `degradedReason`.

### `index.ts` — Registration, lifecycle, persistence

Wires the extension into `ExtensionAPI`.

- `registerContextView()`: lazy registration on the first enabled `session_start`.
- `activateContextView()`: installs event handlers, restores/persists probe identities, and registers the command and Vim event.
- Event handlers:
  - `session_start`: tracks latest context, restores probe identities, clears compaction state.
  - `session_before_compact` / `session_compact` / `session_compact_failed`: track the compaction-active guard.
  - `input`: observes empty extension inputs for the probe and resets text earlier input transforms added to the synthetic prompt.
  - `before_agent_start`: claims the probe run by token, prepares capture options and the handler-bounded prompt.
  - `turn_start`: aborts the real turn when the probe owns the run.
  - `message_start`: records probe message identities.
  - `message_end`: sanitizes probe messages (blank prompt, empty successful stop for aborts).
  - `context`: filters probe messages, finalizes the Initial snapshot.
  - `agent_settled`: settles the probe and persists new identities.
  - `session_shutdown`: fails the probe and persists identities.
- Command handler validates enabled flag, no arguments, and TUI mode before opening the dialog.
- Vim event handler opens the dialog from the latest context.

### `constants.ts`

- `COMMAND_NAME = 'context-view'`.
- `PI_VIM_KEY_EVENT_ID`: shared Vim event id helper.

## UI Roles

### `ui/context-view-dialog.ts`

Bounded half-height shell with configurable inline or overlay presentation.

- `ContextViewDialog`: implements `Component` and `Focusable` by wrapping a `ModalDialog` from the shared modal library (`src/libs/modal/`), configured with the presenter-resolved inline/bordered frame, Vim navigation scheme, half-height bound, and the degraded reason as a shell notice.
- `Tab`/`Shift+Tab` switches between `usage` and `injections`; both tab instances are retained so each preserves its scroll/selection/preview-layer state.
- Vim keys (`j/k`, arrows, `Ctrl+u/d`, `gg/G`, Enter, Esc/`q`) are parsed by the library's `VimNavigationScheme`; unhandled input goes to the active tab.
- Height is bounded to half the terminal by the shell in both layouts.

### `ui/usage-view.ts`

Stateful Usage tab (`ModalTab`).

- Renders a proportional 14×14 context-window map (`UsageMap`), category legend, and reported/estimated summary within the shell-provided content height.
- Map scale toggles between `window` (reported context window) and `fit` (115% headroom, rounded to 2 significant digits) with `z` when applicable.
- Preview (Enter) pushes a `PreviewLayer` showing chronological content entries for the selected category; scrolling/paging/bounds are handled by the layer via shell navigation actions.
- Handles invisible-reasoning metadata display in Agent Thinking Messages.
- Caches rendered output via the library's `RenderCache` and invalidates on theme/selection/scroll changes.

### `ui/injections-view.ts`

Stateful Injections tab (`ModalTab`).

- Renders the hierarchical Initial snapshot: groups (source), items, sub-items (children), and a non-selectable TOTAL row.
- Preview (Enter) pushes a `PreviewLayer` showing the raw text of the selected injection item, with section subheaders, dropped/moved markers, JSON expansion, and injected prompt-line references.
- Tree rendering uses `├─`/`└─`/`│` prefixes and a stable shared value column.
- Currently only the `[INITIAL]` tab is rendered; `[Runtime]` is intentionally hidden until implemented.

### `ui/injections-model.ts`

Pure presentation model for Injections.

- `InjectionRow`: flattened row types (`group`, `item`, `separator`, `total`).
- `buildInjectionRows()`: flattens `InitialSnapshot` into rows.
- `collectItemsById()`: indexes items (including children) for preview lookup.
- `normalizePreviewText()` / `normalizeInlineText()` are re-exported from `text.ts` for previews.
- `ListNavigator`/`PreviewScroller` moved to the shared modal library (`src/libs/modal/list-navigator.ts`).

### `ui/usage-map.ts`

Pure 14×14 proportional map model.

- `buildUsageMap()`: assigns cells to categories by largest overlap; fills `full`, `partial`, `buffer`, or `free`.
- `calculateFitMapScale()`: computes a Fit denominator with 115% headroom, capped at the reported context window and floored at 10,000 tokens.

### `ui/json-preview.ts`

- `expandJsonSpan()`: expand a marked JSON run into pretty-printed text.
- `shiftJsonSpan()`: translate a JSON span when earlier text was removed for display.

### `ui/markers.ts`

- `ContextMarker` (`dropped`, `moved`, `guess`) with `MARKER_ORDER`.
- `droppedMarker()` / `movedMarker()` / `guessMarker()` and `markerLegendLines()`: themed glyphs and legend for prompt-part provenance.

### `ui/wheel.ts` / `ui/wheel-preview-layer.ts`

- `parseWheelDirection()` / `readWheelScrollLines()`: decode terminal wheel input and configured scroll lines.
- `WheelPreviewLayer` (`ModalLayer`): a preview layer that scrolls on wheel events.

### `ui/section-preview.ts`

- `previewLegendLines()` / `previewBodyLines()`: shared sectioned preview rendering (subheaders, JSON, references).
- `SectionedContent`, `PreviewDescriptionLayout`.

### `ui/skill-preview.ts`

Preview-only recognition of pi `<skill name="...">` wrappers.

- `splitSkillPreview()`: splits user-message text into `text` and `skill` segments so the UI can render compact skill badges.

## Data Flow

1. `registerContextView()` waits for the first enabled `session_start`, then calls `activateContextView()`.
2. `activateContextView()` restores any persisted probe identities from custom session entries.
3. On `before_agent_start`, `capture.prepare()` saves owned prompt options and the handler-bounded prompt; `probe.beginRun()` claims the run by token.
4. On `context`, `probe.filterMessages()` removes synthetic probe messages; the remaining messages are diffed against the session-branch baseline to identify request-only injections; `capture.finalize()` freezes the Initial snapshot.
5. On `agent_settled`, the probe is settled and new identities are persisted to `pi-context-view:probe-identities`.
6. When the user invokes `/context-view` or the Vim event, `prepareContextViewData()`:
   - waits for agent idle;
   - triggers a silent probe if no Initial snapshot exists;
   - builds a current branch snapshot by replaying transcript system state and merging frozen request-only messages;
   - reads the compaction reserve and computes the usage snapshot, then opens `ContextViewDialog`.
7. The shared modal presenter opens `ContextViewDialog` using `context_view.layout`; the dialog starts on Usage, remains bounded to half terminal height, and routes input to the active tab while retaining both tab states.

## State Transitions

### InitialCaptureState

- `prepare(options, promptAtHandler)` → stores latest options and `pendingPreparation` (only until snapshot frozen).
- `finalize(buildInput)` → if `initialSnapshot` is undefined, builds and freezes it; subsequent calls return the same snapshot.

### CompactionState

- `begin(signal)` → tracks the active compaction signal.
- `finish()` → clears it after success/abort/settlement.

### SilentProbeState

- `start()` → `idle → waiting`; creates a timeout; returns the existing completion on re-entry.
- `isProbeInput(source, token)` with the matching token → the synthetic prompt is recognized.
- `beginRun(token)` with the matching token → `waiting → running`; a token-less run fails the attempt without arming the abort guard.
- `recordMessage()` / `sanitizeMessage()` → records identities and blanks probe prompt/abort messages.
- `settle(captured)` → `running → settled`.
- `fail(reason)` → resolves a pending attempt.
- Identities are persisted only after settlement or shutdown.

### ContextViewDialog

- `usage ↔ injections` via `Tab`/`Shift+Tab`, including while a preview layer is open.
- The active tab handles selection and scroll via navigation actions; Enter pushes a preview layer.
- `Esc`/`q` pops the active tab's preview layer first, then closes the dialog.

## Integration Points

- **Config**: `config-loader.isEnabled('context_view')` gates activation and command use; `config-loader.getContextView().layout` selects inline or overlay presentation (default `inline`).
- **ExtensionAPI**: `pi.on(...)`, `pi.registerCommand(...)`, `pi.events.on(...)`, `pi.appendEntry(...)`, `pi.getAllTools()`, `pi.getActiveTools()`, `pi.getCommands()`, `pi.sendUserMessage('')`.
- **ExtensionContext**: `ctx.ui.custom<void>()`, `ctx.ui.notify()`, `ctx.abort()`, `ctx.getSystemPrompt()`, `ctx.getSystemPromptOptions()`, `ctx.getContextUsage()`, `ctx.waitForIdle()`, `ctx.mode`, `ctx.model`, `ctx.modelRegistry.hasConfiguredAuth()`, `ctx.sessionManager.getEntries()`, `ctx.sessionManager.getLeafId()`, `ctx.isProjectTrusted()`, `ctx.cwd`.
- **Pi host runtime**: `buildSessionContext`, `convertToLlm`, `estimateTokens`, `formatSize`, `SettingsManager`, `SystemMessage`/`ContextEvent` types, `ToolInfo`/`SlashCommandInfo`/`SourceInfo`.
- **TUI**: `TUI`, `Theme`, `KeybindingsManager`, `Component`, `Focusable`, `Key`, `matchesKey`, `visibleWidth`, `wrapTextWithAnsi`.
- **Modal library**: `src/libs/modal/` (`ModalDialog`, `VimNavigationScheme`, `ModalTab`, `PreviewLayer`, `ListNavigator`, `RenderCache`, text/layout helpers).
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
