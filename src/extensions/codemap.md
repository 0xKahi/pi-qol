# src/extensions/

## Responsibility

This folder contains the feature-level extension modules for `pi-qol`. Each child module registers one self-contained quality-of-life feature into the Pi Coding Agent runtime by subscribing to lifecycle events, commands, and UI hooks exposed by the `ExtensionAPI`.

Current features:

- `auto-session-name` – automatically generates and applies a concise session title from the user’s first message.
- `model-select` – provides an interactive `/select-model` command (and cross-extension activation hook) for choosing models from the registry with permanent Favourites, ordered custom groups, Search, provider filtering, and inline or overlay layout.
- `custom-footer` – replaces the TUI footer with a richer status bar showing cwd, git branch, session name, model, token/cost usage, context-window usage, and subscription usage.
- `context-view` – captures initial context contributions and displays Usage/Injections in a bounded half-height inline tabbed interface with Vim navigation.

## Design Patterns

- **Registration function pattern**: each module exports a single `register*` function that takes `ExtensionAPI` and a `{ config: ConfigLoader }` dependency object. `src/index.ts` calls all three registration functions after initializing configuration.
- **Event-driven lifecycle wiring**: registration is non-blocking; actual work is triggered by Pi runtime events (`session_start`, `session_shutdown`, `before_agent_start`).
- **Lazy / once-only activation**: `model-select` and `custom-footer` use guard flags (`modelSelectRegistered`, `installed`) to ensure handlers or UI components are registered only once per process.
- **Command registration**: `model-select` registers a slash command via `pi.registerCommand` and defers heavy work to an async handler.
- **TUI component pattern**: `custom-footer` constructs a `Component` that renders live on each frame, invalidating Pi’s default footer rendering.
- **Guard classes**: `auto-session-name/guards.ts` isolates predicate logic (session name already set, child session, first user turn) for easy testing and readable early returns.
- **Pure helpers / formatters**: `model-formatter.ts`, `token-stats.ts`, `model-lists.ts`, and `prompt.ts` keep transformation and rendering logic free of side effects.
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
- **`@earendil-works/pi-ai`** – model types (`Model`, `Api`), `completeSimple`, and `modelsAreEqual`.
- **`@earendil-works/pi-tui`** – `Component`, `Focusable`, `Input`, `TUI`, `Theme`, `KeybindingsManager`, and width helpers.
- **`src/config-loader.ts`** – shared `ConfigLoader` used by all three registration functions for feature flags and section config.
- **`src/utils/model-resolver.util.ts`** – resolves provider/model/auth configuration for `auto-session-name`.
- **`src/libs/subscription-usage/`** – `SubscriptionUsageApi` and provider-specific strategies used by the footer to fetch OAuth subscription usage.
- **`src/constants.ts` / `piVimKeyEventId`** – generates the cross-extension event id consumed by `model-select`.
- **`src/index.ts`** – orchestrates config initialization and calls each `register*` function in a fixed order.
