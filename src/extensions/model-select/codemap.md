# src/extensions/model-select/

## Responsibility

This extension implements the `/select-model` command and its interactive picker. Its job is to let the user search, browse, and choose a model from the global model registry, optionally constrained by a provider filter and organized through configured favourites and ordered group tabs. It highlights the currently active model, supports keyboard navigation, and applies the final selection by calling the extension API. It can be triggered both as a user-facing command and programmatically from another extension (e.g., `pi-vim-keys`) via an event-bus hook. The picker can render inline or as a centered overlay, and it surfaces registry errors and favourite configuration warnings inside the UI.

## Design Patterns

- **Lazy command activation**: `registerModelSelect` waits for the first `session_start` event before calling `activateModelSelect`, ensuring the extension is wired up once a session exists and only when `model_select` is enabled.
- **Command + event-bus controller**: `activateModelSelect` registers the `/select-model` command and also listens on a cross-extension event ID so external extensions can open the picker without invoking the command directly.
- **Context caching for async triggers**: The most recent `ExtensionContext` is stored (`latestCtx`) so the event-bus handler (which receives no context argument) can still open the dialog.
- **Separation of concerns**:
  - `index.ts`: orchestrates activation, command handling, applying the selected model, setting default reasoning, and bridging registry errors into the dialog.
  - `model-lists.ts`: queries the registry and prepares favourite, grouped favourite, and searchable model lists; validates favourite entries against the registry and configured auth.
  - `model-formatter.ts`: pure static utilities for labels, descriptions, sorting, token formatting, capability detection, and search-text generation.
  - `model-select-dialog.ts`: thin `ModalDialog` (shared modal library) configuration: one `ListTab` per section (permanent Favourites, groups, Search), a shared filter input, notices for config warnings, and per-section row/empty-state/footer hooks. The shared presenter supplies its resolved inline or bordered frame.
  - `constants.ts`: command name, cross-extension event ID, and dialog rendering limits.
  - `types.ts`: shared item, list, tab, and dialog option types.
- **Modal library delegation**: `ModelSelectDialog` implements `Component` and `Focusable` by delegating to a `ModalDialog` from `src/libs/modal/`; the shell owns the tab strip, tab cycling, keybinding-driven navigation (wrap-around selection via `ListTab`), the shared filter `Input`, and the help footer.
- **Layout-aware presentation**: `showModelSelector` passes `model_select.layout` to the shared modal presenter, which coordinates the dialog's inline/bordered frame with normal or centered overlay mounting.
- **Defensive guards**: checks feature enablement, UI availability, idle state (`waitForIdle`), exact-match short-circuit, and auth availability before applying a model.

## Data & Control Flow

1. **Activation**
   - `registerModelSelect` listens for `session_start`.
   - On first eligible session, it calls `activateModelSelect`, which stores the initial context and registers the `/select-model` command and the `PI_VIM_KEY_EVENT_ID` listener.

2. **Command invocation**
   - The command handler stores the command context as `latestCtx`.
   - It aborts with a warning if `model_select` is disabled.
   - It calls `showModelSelector` with the raw argument string.

3. **Selection short-circuit**
   - `showModelSelector` waits for idle if available, then refreshes the model registry.
   - `findExactModel` tries two forms: `provider/modelId` and whitespace-separated `provider modelId`. If a matching model is found, it is applied immediately via `applySelectedModel` and the dialog is skipped.
   - If no UI is available and there is no exact match, a warning is shown and the picker exits.

4. **Dialog path**
   - If no exact match is found and a UI is present, the extension loads the `model_select` config.
   - `buildModelLists` refreshes the registry, applies `provider_filter` only to the Search tab, sorts search items with the current model first, and validates configured favourites.
   - Favourites must exist in the registry and have configured auth; missing or unauthenticated entries are collected as warnings and omitted from the list.
   - Accepted favourites retain exact group memberships; the ordered `groups` config defines the visible group tabs. Duplicate favourite models are deduplicated by provider/id, and duplicate group names are collapsed while preserving configured order.
   - Any model-registry error is added to the dialog's `configWarnings` so it appears inside the picker.
   - The shared `presentModal` helper creates a `ModelSelectDialog` with favourite/group/search lists, tab visibility controls, the current model, warnings, `initialSearch`, resolved frame, `defaultReasoning`, and an `onDone` callback. The overlay layout remains centered at 85% width with a one-cell margin.
   - The dialog always creates a Favourites tab, adds visible group tabs and optional Search, and renders a width-aware tab strip, shared filter input, warnings, and help footer. If `initialSearch` is non-empty and Search is visible, the dialog starts on the Search tab and seeds the input.

5. **User interaction**
   - Keyboard input is mapped through `keybindings.matches` for navigation, ordered tab cycling (`tab`/`shift+tab`), page up/down, confirmation, and cancellation.
   - Typing updates one shared query and re-filters every visible tab via `fuzzyFilter`; each tab retains its own selection index.
   - The Search tab displays the active `provider_filter` above the query input.
   - Confirming a selection invokes `onDone` with the chosen `Model`; cancelling invokes `onDone(null)`.

6. **Apply result**
   - If a model is selected, `applySelectedModel` calls `pi.setModel`.
   - On success, if `model_select.default_reasoning` is configured and the chosen model supports that level, `pi.setThinkingLevel` is called to apply it.
   - A success or missing-auth notification is shown via `ctx.ui.notify`.

## Configuration & Schema

The `model_select` configuration is defined by `../../schemas/model-select.config.schema` and included in the top-level `ConfigSchema` in `../../schemas/config.schema`.

- `enabled` (`boolean`, default `false`): feature toggle.
- `favourite` (`array`): each entry is `{ provider, modelId, groups?: string[] }`. Favourites are validated against the registry and auth state.
- `favourite_label` (`string`, default `'Favourites'`): label for the Favourites tab.
- `groups` (`array` of non-empty strings): ordered group names used as tabs; favourites can be assigned to one or more groups.
- `hide_tabs` (`{ groups: boolean, search: boolean }`, default both `false`): controls visibility of group tabs and the Search tab.
- `provider_filter` (`array` of non-empty strings): restricts the Search tab to the listed providers; Favourites and group tabs are not filtered.
- `default_reasoning` (optional `'off' | 'minimal' | 'low' | 'medium' | 'high' | 'xhigh'`): applied to the selected model if `getSupportedThinkingLevels` includes it.
- `layout` (`'inline' | 'overlay'`, default `'inline'`): picker layout.

## Integration Points

- **`ExtensionAPI` (`@earendil-works/pi-coding-agent`)**: used to register the command, listen to `session_start`, set the active model (`pi.setModel`), set the thinking level (`pi.setThinkingLevel`), and access the shared event bus (`pi.events`).
- **`ExtensionContext` / `ExtensionCommandContext` (`@earendil-works/pi-coding-agent`)**: provides `modelRegistry`, `ui`, `hasUI`, `model`, `cwd`, and the optional `waitForIdle` guard.
- **`ModelRegistry`**: refreshed and queried for available models, configured auth, lookup by `provider` + `modelId`, and error state (`getError`).
- **`ConfigLoader` (`../../config-loader`)**: provides feature toggle state (`isEnabled('model_select')`), the typed `model_select` configuration object, and merges global + project JSON config.
- **`@earendil-works/pi-ai`**: supplies the `Model<Api>` type, `modelsAreEqual` for stable identity comparisons, and `getSupportedThinkingLevels` for reasoning-level validation.
- **`@earendil-works/pi-tui`**: supplies the `Input` component, `fuzzyFilter`, `matchesKey`, theme helpers, and rendering utilities (`truncateToWidth`, `visibleWidth`) used by the dialog.
- **`pi-vim-keys` / other extensions**: can trigger the picker by emitting `PI_VIM_KEY_EVENT_ID` on the shared event bus.
- **`../../constants`**: provides the `piVimKeyEventId` helper used to derive the cross-extension event ID.
- **Configuration schemas**: `model_select` shape, `ModelSelectLayout`, `HideTabs`, and `ReasoningLevel` are defined by `../../schemas/model-select.config.schema`, `../../schemas/config.schema`, and `../../schemas/shared-config.schema`.
