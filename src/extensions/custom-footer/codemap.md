# src/extensions/custom-footer/

## Responsibility

Renders a custom TUI footer that replaces the default agent footer. It displays:

- The current working directory (with an optional custom color), git branch, and session name.
- Token usage totals (input/output) for assistant messages in the current session.
- Cache read/write totals and the latest cache hit rate.
- Estimated session cost, with a subscription indicator when using OAuth models.
- Context window usage as a percentage of the active model's context window.
- OAuth subscription usage (Anthropic / OpenAI Codex) including a progress bar, percentage, and reset description.
- The active model name and reasoning/thinking level.
- Sorted, sanitized extension status messages.

The extension is feature-gated by the `custom_footer` config flag and can dynamically restore the default footer when disabled.

## Design Patterns

- **Plugin registration**: `index.ts` listens to the agent's `session_start` event and registers a single footer component factory via `ctx.ui.setFooter`.
- **Component pattern**: `CustomFooterComponent` implements the `Component` interface (`render`, `invalidate`, `dispose`) so the TUI can call it on every frame.
- **Dependency injection**: The component receives its dependencies (`tui`, `theme`, `footerData`, `ctx`, `config`, `getThinkingLevel`) in a single `CustomFooterComponentDeps` object, keeping rendering logic decoupled from construction.
- **Data provider abstraction**: `FooterDataProvider` isolates footer-specific data (git branch, extension statuses, provider count, branch-change notifications) from the broader `ExtensionContext`.
- **Cache manager**: `SubscriptionUsageManager` caches OAuth usage responses with a TTL and coalesces in-flight requests per provider.
- **Strategy pattern**: Provider-specific OAuth usage fetch strategies (`AnthropicOauthUsageStrategy`, `OpenAiCodexUsageStrategy`) are selected at runtime inside `SubscriptionUsageManager`.
- **Provider normalization**: `resolveSupportedProvider` maps provider aliases (`codex`, `openai`, `chatgpt`) to the internal `SupportedProvider` union.
- **Window selection**: `pickSubscriptionUsageWindow` chooses the rate window with the nearest reset, falling back to the first window when no resets are available.
- **Pure formatting helpers**: `token-stats.ts` and `progress-bar.ts` contain stateless functions for number formatting, usage aggregation, subscription segment construction, and progress-bar rendering, making them easy to test.

## Data & Control Flow

1. **Registration**: `registerCustomFooter` waits for `session_start`, checks the `custom_footer` feature flag, and installs `CustomFooterComponent` as the footer renderer. It guards against double installation.
2. **Rendering trigger**: The TUI calls `CustomFooterComponent.render(width)` on every footer repaint.
3. **Dynamic disable**: If `custom_footer` is disabled at render time, the component calls `ctx.ui.setFooter(undefined)` once and returns an empty array so the default footer is restored.
4. **Line assembly**: `render` builds up to three lines:
   - `renderPathLine`: directory (with optional custom color), branch, session name.
   - `renderStatsLine`: token/cost/context/subscription stats plus the model name.
   - Extension status line (only when statuses exist).
5. **Usage aggregation**: `calculateUsageTotals` in `token-stats.ts` sums assistant-message token counts and computes the latest cache hit rate from `sessionManager.getEntries()`.
6. **Stats composition**: `buildStatsLeft` receives the pre-computed totals, display toggles, context usage, context window, subscription segment, and theme; it returns the left-hand stats string.
7. **Subscription usage**: `renderSubscriptionUsageSegment` resolves the provider, asks `SubscriptionUsageManager.ensureFresh(provider)` for cached data, picks the rate window with the nearest reset via `pickSubscriptionUsageWindow`, and builds a colored progress segment via `buildSubscriptionUsageSegment` in `token-stats.ts`.
8. **Async refresh**: `SubscriptionUsageManager` fetches usage asynchronously when the cached entry is older than `SUBSCRIPTION_USAGE_TTL_MS`. On success it calls `tui.requestRender()` via the `onUpdate` callback to update the footer.
9. **Git branch updates**: `footerData.onBranchChange` registers a render request callback that is cleaned up in `dispose`.

## Integration Points

- **`@earendil-works/pi-coding-agent`**: Uses `ExtensionAPI` (event subscription, `getThinkingLevel`), `ExtensionContext` (`model`, `modelRegistry`, `sessionManager`, `getContextUsage`, `ui.setFooter`), and `ContextUsage` / `SessionEntry` types.
- **`@earendil-works/pi-tui`**: Implements the `Component` contract and uses `truncateToWidth`, `visibleWidth`, and `TUI.requestRender`.
- **`../../config-loader`**: Reads the `custom_footer` feature flag and full footer config (colors, icons, display toggles) via `ConfigLoader`.
- **`../../schemas/config.schema`**: `CustomFooterConfig` is derived from the `Config` schema's `custom_footer` shape.
- **`@0xkahi/cli-dye`**: Applies configured truecolor ANSI styling to directory text, model name, subscription usage labels, and progress-bar fill.
- **`../../libs/subscription-usage/**`**: Delegates OAuth usage fetching and reset formatting to `SubscriptionUsageApi` and provider-specific strategies.
