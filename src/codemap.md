# src/

## Responsibility

Top-level source root for `pi-qol`, a Pi coding-agent extension that layers small quality-of-life features onto the agent core.

It coordinates three feature modules:

- **auto_session_name**: Generates and applies a concise session title from the user's first message before the agent runs.
- **model_select**: Registers a `/select-model` command (plus a cross-extension event) for picking or searching available models with favourites, ordered custom groups, provider filtering, and an inline or overlay layout.
- **custom_footer**: Replaces the default footer with a richer status bar showing cwd/branch/session, token/cost/cache stats, context-window usage, subscription-rate usage, and the current model/thinking level.

Shared concerns live here too: extension configuration loading, path resolution, model/auth resolution, and Zod schemas for every feature.

## Design Patterns

- **Plugin / Extension registration**: `index.ts` is a thin bootstrap that instantiates shared services and calls `register*` factory functions for each feature. Each feature registers itself against the `ExtensionAPI` event bus and command surface.
- **Event-driven lifecycle**: Features hook into `session_start`, `session_shutdown`, and `before_agent_start` events. They gate behaviour behind config flags and store transient state in closure variables (`lastSessionStartReason`, `titleController`, `installed`, `latestCtx`).
- **Configuration layering**: `ConfigLoader` merges a built-in default with a global JSON config and an optional project-level config, validated and typed with Zod. Only trusted projects load project-level overrides.
- **Strategy pattern for subscription usage**: `SubscriptionUsageManager` dispatches to provider-specific `SubscriptionUsageStrategy` implementations (`AnthropicOauthUsageStrategy`, `OpenAiCodexUsageStrategy`) behind a common `SubscriptionUsageApi` interface.
- **Component-based TUI**: `CustomFooterComponent` and `ModelSelectDialog` implement the host TUI's `Component`/`Focusable` interfaces, render to string arrays, and rely on the host for input routing and re-rendering.
- **Abortable async work**: `auto_session_name` tracks an `AbortController` across `before_agent_start` invocations so stale title requests are cancelled before a new one starts.
- **Utility classes as pure helpers**: `PathUtil`, `ModelResolver`, `ModelFormatter`, `AutoSessionNameGuard`, `AutoSessionNameTitleGenerator` are stateless or request-scoped helpers.

## Data & Control Flow

1. **Bootstrap** (`index.ts`)
   - Creates `ConfigLoader`.
   - On every `session_start`, calls `config.initializeConfig(ctx)`; surfaces validation errors via `ctx.ui.notify`.
   - Registers the three feature modules, passing the shared loader.

2. **Config loading** (`config-loader.ts`, `utils/path.util.ts`, `schemas/*.schema.ts`)
   - Defaults → global `~/.pi/extensions/pi-qol/config.json` → project `.pi/extensions/pi-qol/config.json` (if trusted).
   - Each partial config is shallow-merged per top-level key and re-validated by `ConfigSchema`.
   - `PathUtil` owns the config/auth file path conventions.

3. **auto_session_name** (`extensions/auto-session-name/`)
   - Captures `session_start.reason`.
   - On `before_agent_start`, guards check: enabled, no existing session name, not a child/fork session, and first user turn.
   - `ModelResolver` picks the configured model or falls back to the session model, requiring resolvable auth.
   - `AutoSessionNameTitleGenerator` builds a title-generation context, calls `completeSimple` from `pi-ai`, strips thinking tags/quotes, truncates to `MAX_TITLE_LENGTH`, and applies it via `pi.setSessionName`.

4. **model_select** (`extensions/model-select/`)
   - Lazily registers once on `session_start` when enabled.
   - `/select-model [args]` handler refreshes the registry, attempts an exact provider/model match, otherwise opens a custom TUI dialog with Favourites, group, and Search tabs.
   - `ModelSelectDialog` filters search items with fuzzy matching, navigates favourites/search sections, and returns the chosen model to `pi.setModel`.
   - `PI_VIM_KEY_EVENT_ID` allows other extensions to trigger the same picker.

5. **custom_footer** (`extensions/custom-footer/`)
   - On first enabled `session_start`, installs a footer component via `ctx.ui.setFooter`.
   - Each render reads live data from `ExtensionContext` (`sessionManager`, `modelRegistry`, `model`, `getContextUsage`, `footerData`), calculates session totals, formats tokens/cost/context usage, and optionally fetches subscription usage through cached strategies.

## Integration Points

- **@earendil-works/pi-coding-agent**: Provides `ExtensionAPI`, `ExtensionContext`, `ExtensionCommandContext`, events (`session_start`, `session_shutdown`, `before_agent_start`), command registration (`pi.registerCommand`), UI notifications (`ctx.ui.notify`), footer injection (`ctx.ui.setFooter`), custom dialogs (`ctx.ui.custom`), session naming (`pi.setSessionName`/`getSessionName`), and model selection (`pi.setModel`/`getThinkingLevel`).
- **@earendil-works/pi-ai**: Used for `completeSimple`, `Model<Api>`, `modelsAreEqual`, and model-metadata types during title generation and model selection.
- **@earendil-works/pi-tui**: Provides the `Component`/`Focusable` contracts, `TUI`, `Theme`, `Input`, and text-width helpers (`truncateToWidth`, `visibleWidth`, `fuzzyFilter`) used by the footer and model picker.
- **Filesystem**: Reads global and project JSON configs and `~/.pi/auth.json` for OAuth tokens.
- **External provider APIs**: `SubscriptionUsageApi` and strategies call Anthropic/OpenAI Codex usage endpoints when OAuth auth is present.
- **Cross-extension events**: `piVimKeyEventId` from `constants.ts` lets other Pi extensions emit events that `model_select` listens on.
