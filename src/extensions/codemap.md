# src/extensions/

## Responsibility

This folder contains the feature-level extension modules for `pi-qol`. Each child module registers one self-contained quality-of-life feature into the Pi Coding Agent runtime by subscribing to lifecycle events, commands, and UI hooks exposed by the `ExtensionAPI`.

Current features:

- `auto-session-name` – automatically generates and applies a concise session title from the user’s first message.
- `model-select` – provides an interactive `/select-model` command (and cross-extension activation hook) for choosing models from the registry with permanent Favourites, ordered custom groups, fuzzy search, provider filtering, and inline or overlay layout.
- `context-view` – captures model context contributions and displays Usage/Injections in a bounded half-height inline tabbed interface opened by command or Vim event.
- `custom-footer` – replaces the TUI footer with a richer status bar showing cwd, git branch, session name, model, token/cost usage, context-window usage, and subscription usage.

---

## Extension Modules

### 1. `auto-session-name`

#### Context view

`registerAutoSessionName` keeps a small module-level state: `lastSessionStartReason` (the `reason` from the latest `session_start`) and `titleController` (the current `AbortController` for the in-flight title generation). This state is intentionally minimal because the feature is single-shot per session.

#### Event / lifecycle registration

The registration function wires three `ExtensionAPI` events:

- `session_start` – stores the session start reason for later child-session detection.
- `session_shutdown` – aborts and clears any pending title request.
- `before_agent_start` – performs the guard checks, aborts the previous request, and starts the async title generation.

#### Data & control flow

1. On `before_agent_start` the handler short-circuits unless:
   - `auto_session_name` is enabled.
   - No session name is currently set.
   - The session is not a child/fork session (using `lastSessionStartReason` and `ctx.sessionManager`).
   - This is the user’s first turn.
   - The current prompt contains non-empty text.
2. The configured model is resolved via `ModelResolver` from the per-feature config.
3. `AutoSessionNameTitleGenerator.generateAndApplyTitle` builds a single-turn prompt, calls `completeSimple`, strips `<think>` blocks, cleans and truncates the result, and applies it via `pi.setSessionName`.
4. A post-condition compares `pi.getSessionName()` with the generated title; a warning is shown if they diverge.
5. Success or any failure is reported through `ctx.ui.notify`.

#### Integration points

- **`@earendil-works/pi-coding-agent`**: `ExtensionAPI` events (`session_start`, `session_shutdown`, `before_agent_start`), `getSessionName`, `setSessionName`, and `ctx.ui.notify`.
- **`@earendil-works/pi-ai`**: `completeSimple` for the LLM title completion.
- **`../../config-loader`**: `isEnabled('auto_session_name')` and `getAutoSessionName()` for the feature toggle and model override.
- **`../../utils/model-resolver.util`**: `ModelResolver` resolves provider/model/auth configuration.
- **`ctx.sessionManager`**: used by `AutoSessionNameGuard` to detect first user turns and parent sessions.

---

### 2. `model-select`

#### Context view

`registerModelSelect` exposes `applySelectedModel` and `showModelSelector` as the public action surface. The registration itself is lazy: `modelSelectRegistered` ensures `activateModelSelect` is only run once per process. `activateModelSelect` caches the most recent `ExtensionContext` in `latestCtx` so the cross-extension event bus can open the picker even when no command context is available.

#### Event / lifecycle registration

- `session_start` – the outer `registerModelSelect` listener checks the feature flag and lazily activates the module once.
- Inside `activateModelSelect`:
  - `session_start` refreshes `latestCtx`.
  - `pi.registerCommand(COMMAND_NAME)` registers `/select-model` with the interactive handler.
  - `pi.events.on(PI_VIM_KEY_EVENT_ID)` listens for cross-extension activation (e.g., from `pi-vim-keys`).

#### Data & control flow

1. The command handler records the latest context, checks the feature flag, and calls `showModelSelector`.
2. `showModelSelector` waits for idle when available, refreshes `ctx.modelRegistry`, and attempts an exact provider/model match through `findExactModel`.
3. If an exact match succeeds, the model is applied immediately via `applySelectedModel` and the dialog is skipped.
4. Otherwise, `buildModelLists` prepares Favourites, ordered group subsets, and Search items. Provider filtering is applied only to Search, and favourite auth/registry warnings are collected.
5. `ctx.ui.custom` creates a `ModelSelectDialog` configured with the current model, lists, tab visibility, warnings, initial search, and layout.
6. The dialog shares a single query across visible tabs, preserves per-tab selection, cycles tabs, and renders either inline or as a centered overlay at 85% width.
7. On selection, `applySelectedModel` calls `pi.setModel` and, if supported, sets the configured default reasoning level via `pi.setThinkingLevel`; missing auth is reported as an error.

#### Integration points

- **`@earendil-works/pi-coding-agent`**: `ExtensionAPI` command registration, event subscription, `setModel`, `setThinkingLevel`, and `getThinkingLevel`; `ExtensionContext` / `ExtensionCommandContext` for `modelRegistry`, `ui`, `hasUI`, `model`, and `waitForIdle`.
- **`@earendil-works/pi-ai`**: `Model<Api>` type, `getSupportedThinkingLevels`, and `modelsAreEqual` helpers.
- **`@earendil-works/pi-tui`**: `Component`, `Focusable`, `Input`, `fuzzyFilter`, `matchesKey`, `Theme`, and width/truncation helpers.
- **`../../config-loader`**: `isEnabled('model_select')` and the full `model_select` configuration.
- **`../../constants`**: `piVimKeyEventId` generates the shared event id used by the Vim-keys integration.
- **Cross-extension consumers**: `pi.events.emit(PI_VIM_KEY_EVENT_ID)` opens the picker without invoking the slash command.

---

### 3. `context-view`

#### Context view

`registerContextView` is disabled by default and only activates once an enabled session starts. The activation keeps `InitialCaptureState` for the first provider snapshot, `SilentProbeState` for synthetic-probe management, and `latestCtx` for the event-bus handler. The module is intentionally careful to persist only synthetic probe identities (role/timestamp) and never real prompt, tool, or message content.

#### Event / lifecycle registration

`activateContextView` registers a dense set of lifecycle hooks:

- `session_start` – refreshes `latestCtx` and restores persisted probe identities.
- `input` – observes owned user inputs.
- `before_agent_start` – begins a probe run and prepares capture from system prompt options.
- `turn_start` – aborts the current probe run if needed.
- `message_start` / `message_end` – records and sanitizes assistant messages.
- `context` – filters provider messages, freezes the first eligible snapshot, and can optionally replace the outgoing messages.
- `agent_settled` – settles the probe and persists new identities.
- `session_shutdown` – persists identities and fails the probe.
- `pi.registerCommand(COMMAND_NAME)` registers `/context-view`.
- `pi.events.on(PI_VIM_KEY_EVENT_ID)` opens the view from a Vim event.

#### Data & control flow

1. On an enabled session start, the module is installed and any persisted probe identities are restored.
2. `before_agent_start` prepares the initial capture; the `context` event freezes the first eligible provider snapshot.
3. If the view is opened before capture completes, a silent probe runs; synthetic messages are filtered, sanitized, and persisted by identity only.
4. `prepareContextViewData` combines the snapshot, current native prompt/tool data, filtered session messages, and reported usage.
5. `ContextViewDialog` opens as a Usage-first inline component bounded to 50% of the terminal height, retaining state for both the Usage and Injections tabs.
6. Shared navigation (`j`/`k`, arrows, `Ctrl+u`/`d`, `gg`/`G`) is routed through `ui/navigation.ts`.

#### Integration points

- **`@earendil-works/pi-coding-agent`**: `ExtensionAPI` events, `registerCommand`, `events` bus, `buildSessionContext`, and `ctx.sessionManager`.
- **`../../config-loader`**: `isEnabled('context_view')` gates registration and command handlers.
- **`../../constants`**: `piVimKeyEventId` generates the cross-extension event id.
- **`@earendil-works/pi-tui`**: `Component`, `Input`, and focus/routing helpers for the dialog and child views.
- **`ui/` and `capture.ts`**: module-local helpers classify, measure, and render context usage and injections.

---

### 4. `custom-footer`

#### Context view

`registerCustomFooter` stores a single `installed` flag to prevent duplicate footer registration. The actual component is created per render by the factory passed to `ctx.ui.setFooter`, receiving live `tui`, `theme`, `footerData`, `ExtensionContext`, `ConfigLoader`, and a `getThinkingLevel` accessor.

#### Event / lifecycle registration

- `session_start` – the only registration event. When the feature is enabled and the footer is not yet installed, it calls `ctx.ui.setFooter` with a factory that creates a `CustomFooterComponent` for each render.
- No shutdown handler is required because the component implements `dispose` for its own cleanup.

#### Data & control flow

1. On `session_start`, `setFooter` installs the custom footer factory.
2. The TUI calls `CustomFooterComponent.render(width)` on every footer repaint.
3. If the feature is disabled at render time, the component calls `ctx.ui.setFooter(undefined)` once to restore the default footer and returns an empty array.
4. The component assembles up to three lines:
   - `renderPathLine`: directory (with optional custom color), git branch, and session name.
   - `renderStatsLine`: token totals, cache read/write, cache hit rate, estimated cost, context-window usage, subscription usage, and active model.
   - Extension status line when statuses exist.
5. `token-stats.ts` aggregates assistant-message token counts and cache hit rates from `sessionManager.getEntries()`.
6. `SubscriptionUsageManager` caches OAuth usage with a TTL and coalesces in-flight requests; on update it calls `tui.requestRender()` to refresh the footer.
7. `FooterDataProvider` watches git branch changes and similarly requests re-renders; the callback is removed in `dispose`.

#### Integration points

- **`@earendil-works/pi-coding-agent`**: `ExtensionAPI` events, `getThinkingLevel`; `ExtensionContext` for `model`, `modelRegistry`, `sessionManager`, `getContextUsage`, and `ui.setFooter`.
- **`@earendil-works/pi-tui`**: `Component` interface, `truncateToWidth`, `visibleWidth`, and `TUI.requestRender`.
- **`../../config-loader`**: `isEnabled('custom_footer')` and full footer configuration (colors, icons, display toggles).
- **`../../libs/subscription-usage/`**: `SubscriptionUsageApi` and provider-specific strategies (Anthropic OAuth, OpenAI Codex) for subscription usage.
- **`@0xkahi/cli-dye`**: truecolor ANSI styling for directory, model, and subscription usage segments.

---

## Cross-Cutting Design Patterns

- **Registration function pattern**: each module exports a single `register*` function that takes `ExtensionAPI` and a `{ config: ConfigLoader }` dependency object. `src/index.ts` calls all four registration functions after initializing configuration.
- **Event-driven lifecycle wiring**: registration is non-blocking; actual work is triggered by Pi runtime events (`session_start`, `session_shutdown`, `before_agent_start`, `input`, `turn_start`, `message_start`, `message_end`, `context`, `agent_settled`).
- **Lazy / once-only activation**: `model-select`, `context-view`, and `custom-footer` use guard flags (`modelSelectRegistered`, `registered`, `installed`) to ensure handlers or UI components are registered only once per process.
- **Command registration**: `model-select` and `context-view` register slash commands via `pi.registerCommand` and defer work to async handlers.
- **TUI component pattern**: `custom-footer` and the two dialogs construct Pi TUI components that render on every frame and participate in focus/input routing.
- **Guard classes**: `auto-session-name/guards.ts` isolates predicate logic (session name already set, child session, first user turn) for easy testing and readable early returns.
- **Pure helpers / formatters**: `model-formatter.ts`, `token-stats.ts`, `model-lists.ts`, `prompt.ts`, `measure.ts`, and `usage.ts` keep transformation and rendering logic free of side effects.
- **Cross-extension event bus**: `model-select` and `context-view` listen on dedicated `pi.events` channels so other extensions can open their interfaces without invoking slash commands directly.
- **Abortable async work**: `auto-session-name` keeps an `AbortController` and cancels in-flight title generation on `session_shutdown` or a new `before_agent_start`.

## Data & Control Flow

1. **Configuration load** (`src/index.ts`)
   - On `session_start`, `ConfigLoader.initializeConfig(ctx)` merges global and (if trusted) project JSON configs, validated by Zod schemas.
   - All enabled checks and section values are read through `ConfigLoader`.

2. **auto-session-name flow**
   - Records `lastSessionStartReason` on `session_start`.
   - On `before_agent_start`, guards verify the feature is enabled, the session has no name yet, it is not a child session, and this is the user’s first turn.
   - Resolves the configured title-generation model via `ModelResolver`.
   - Calls `completeSimple` with a small title-generation context built by `prompt.ts`.
   - Cleans the result, calls `pi.setSessionName(title)`, and notifies the UI.
   - Aborts any previous in-flight request before starting a new one.

3. **model-select flow**
   - Lazy-activated once on `session_start` if enabled.
   - Command handler calls `waitForIdle` (when available), refreshes `ctx.modelRegistry`, attempts an exact provider/model match from arguments, then falls back to an interactive `ModelSelectDialog`.
   - List preparation resolves authenticated favourites, derives exact case-sensitive group subsets, and applies provider filtering only to Search.
   - The dialog uses one fuzzy query across dynamically visible Favourites/group/Search tabs, preserves per-tab selection, keeps the active tab represented at narrow widths, and renders in an inline or overlay layout; selection is applied via `pi.setModel`.
   - The event-bus handler captures the latest context so the picker can also be opened without a command context.

4. **context-view flow**
   - Lazily activates only when `context_view.enabled` is true at session start.
   - Captures owned prompt/tool/message inputs, freezes the first provider-context snapshot, and filters exact synthetic-probe identities.
   - `/context-view` and `pi.vimKeys.event:pi-qol.context_view` share data preparation and open a bounded half-height Usage-first inline interface.
   - The dialog retains Usage/Injections child state and routes Tab plus Vim navigation (`j/k`, `Ctrl+u/d`, `gg/G`).

5. **custom-footer flow**
   - On `session_start`, installs a `CustomFooterComponent` factory via `ctx.ui.setFooter`.
   - Each render reads from `ExtensionContext` (cwd, session name, model, context usage, entries), `FooterDataProvider` (git branch, extension statuses, available providers), and a cached `SubscriptionUsageManager`.
   - The component builds and truncates lines to the available terminal width and requests re-renders via `tui.requestRender()` when branch changes or subscription usage updates.

## Integration Points

- **`@earendil-works/pi-coding-agent`** – `ExtensionAPI`, `ExtensionContext`, `ExtensionCommandContext`, events, commands, session manager, and UI notifications.
- **`@earendil-works/pi-ai`** – model types (`Model`, `Api`), `completeSimple`, `getSupportedThinkingLevels`, and `modelsAreEqual`.
- **`@earendil-works/pi-tui`** – `Component`, `Focusable`, `Input`, `TUI`, `Theme`, `KeybindingsManager`, and width helpers.
- **`src/config-loader.ts`** – shared `ConfigLoader` used by all four registration functions for feature flags and section config.
- **`src/utils/model-resolver.util.ts`** – resolves provider/model/auth configuration for `auto-session-name`.
- **`src/libs/subscription-usage/`** – `SubscriptionUsageApi` and provider-specific strategies used by the footer to fetch OAuth subscription usage.
- **`src/constants.ts` / `piVimKeyEventId`** – generates the cross-extension event ids consumed by `model-select` and `context-view`.
- **`src/index.ts`** – orchestrates config initialization and calls each `register*` function in a fixed order.
- **`@0xkahi/cli-dye`** – truecolor ANSI styling used by the custom footer.

(End of file)
