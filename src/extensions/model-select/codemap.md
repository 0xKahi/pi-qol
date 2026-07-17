# src/extensions/model-select/

## Responsibility

This extension implements the `/select-model` command and its interactive picker. Its job is to let the user search, browse, and choose a model from the global model registry, optionally constrained by a provider filter and organized through configured favourites and ordered group tabs. It highlights the currently active model, supports keyboard navigation, and applies the final selection by calling the extension API. It can be triggered both as a user-facing command and programmatically from another extension (e.g., `pi-vim-keys`) via an event-bus hook. The picker can render inline or as a centered overlay, and it surfaces registry errors and favourite configuration warnings inside the UI.

## Design Patterns

- **Lazy command activation**: `registerModelSelect` waits for the first `session_start` event before calling `activateModelSelect`, ensuring the extension is wired up once a session exists.
- **Command + event-bus controller**: `activateModelSelect` registers the `/select-model` command and also listens on a cross-extension event ID so external extensions can open the picker without invoking the command directly.
- **Context caching for async triggers**: The most recent `ExtensionContext` is stored (`latestCtx`) so the event-bus handler (which receives no context argument) can still open the dialog.
- **Separation of concerns**:
  - `index.ts`: orchestrates activation, command handling, applying the selected model, and bridging registry errors into the dialog.
  - `model-lists.ts`: queries the registry and prepares favourite, grouped favourite, and searchable model lists; validates favourite entries against the registry and configured auth.
  - `model-formatter.ts`: pure static utilities for labels, descriptions, sorting, token formatting, and search-text generation.
  - `model-select-dialog.ts`: TUI component that builds dynamic visible tabs, renders a width-aware tab viewport, and translates user input into selection events.
  - `constants.ts`: command name, cross-extension event ID, and dialog rendering limits.
- **TUI Component pattern**: `ModelSelectDialog` implements `Component` and `Focusable`, rendering itself into lines and delegating focus to an internal `Input` component.
- **Layout-aware rendering**: the dialog renders either an inline bordered panel or a centered overlay depending on the `model_select.layout` config value.
- **Defensive guards**: checks feature enablement, UI availability, idle state (`waitForIdle`), exact-match short-circuit, and auth availability before applying a model.

## Data & Control Flow

1. **Activation**
   - `registerModelSelect` listens for `session_start`.
   - On first eligible session, it calls `activateModelSelect`, which stores the initial context and registers the `/select-model` command and the `PI_VIM_KEY_EVENT_ID` listener.

2. **Command invocation**
   - The command handler stores the command context as `latestCtx`.
   - It aborts if `model_select` is disabled.
   - It calls `showModelSelector` with the raw argument string.

3. **Selection short-circuit**
   - `showModelSelector` waits for idle if available, then refreshes the model registry.
   - `findExactModel` tries two forms: `provider/modelId` and whitespace-separated `provider modelId`. If a matching model is found, it is applied immediately and the dialog is skipped.
   - If no UI is available and there is no exact match, a warning is shown and the picker exits.

4. **Dialog path**
   - If no exact match is found and a UI is present, the extension loads the `model_select` config.
   - `buildModelLists` refreshes the registry, applies `provider_filter` only to Search, sorts search items with the current model first, and validates configured favourites (collecting warnings for missing models or missing auth).
   - Accepted favourites retain exact group memberships long enough to derive ordered group subsets; duplicate group names and favourite models use first-occurrence semantics.
   - Any model-registry error is added to the dialog's `configWarnings` so it appears inside the picker.
   - `ctx.ui.custom` creates a `ModelSelectDialog` with favourite/group/search lists, tab visibility controls, the current model, warnings, `initialSearch`, `layout`, and an `onDone` callback. The overlay layout is centered at 85% width with a one-cell margin.
   - The dialog always creates Favourites first, adds visible group tabs and optional Search, and renders a width-aware tab strip, shared filter input, warnings, and help footer. If `initialSearch` is non-empty and Search is visible, the dialog starts on the Search tab and seeds the input.

5. **User interaction**
   - Keyboard input is mapped through `keybindings.matches` for navigation, ordered tab cycling (`tab`/`shift+tab`), page up/down, confirmation, and cancellation.
   - Typing updates one shared query and re-filters every visible tab via `fuzzyFilter`; each tab retains its own selection index.
   - The Search tab displays the active `provider_filter` above the query input.
   - Confirming a selection invokes `onDone` with the chosen `Model`; cancelling invokes `onDone(null)`.

6. **Apply result**
   - If a model is selected, `applySelectedModel` calls `pi.setModel`.
   - A success or missing-auth notification is shown via `ctx.ui.notify`.

## Integration Points

- **`ExtensionAPI` (`@earendil-works/pi-coding-agent`)**: used to register the command, listen to `session_start`, set the active model (`pi.setModel`), and access the shared event bus (`pi.events`).
- **`ExtensionContext` / `ExtensionCommandContext` (`@earendil-works/pi-coding-agent`)**: provides `modelRegistry`, `ui`, `hasUI`, `model`, and the optional `waitForIdle` guard.
- **`ModelRegistry`**: refreshed and queried for available models, configured auth, lookup by `provider` + `modelId`, and error state (`getError`).
- **`ConfigLoader` (`../../config-loader`)**: provides feature toggle state (`isEnabled('model_select')`) and the typed `model_select` configuration object.
- **`@earendil-works/pi-ai`**: supplies the `Model<Api>` type and `modelsAreEqual` for stable identity comparisons.
- **`@earendil-works/pi-tui`**: supplies the `Input` component, `fuzzyFilter`, `matchesKey`, theme helpers, and rendering utilities (`truncateToWidth`, `visibleWidth`) used by the dialog.
- **`pi-vim-keys` / other extensions**: can trigger the picker by emitting `PI_VIM_KEY_EVENT_ID` on the shared event bus.
- **Configuration schemas**: `model_select` shape, `ModelSelectLayout`, and `HideTabs` are defined by `../../schemas/config.schema` and `../../schemas/model-select.config.schema`.
