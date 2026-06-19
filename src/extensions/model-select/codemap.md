# src/extensions/model-select/

## Responsibility

This extension implements the `/select-model` command and its interactive picker. Its job is to let the user search, browse, and choose a model from the global model registry, optionally constrained by a provider filter and a configured list of favourites. It highlights the currently active model, supports keyboard navigation, and applies the final selection by calling the extension API. It can be triggered both as a user-facing command and programmatically from another extension (e.g., `pi-vim-keys`) via an event-bus hook.

## Design Patterns

- **Lazy command activation**: `registerModelSelect` waits for the first `session_start` event before calling `activateModelSelect`, ensuring the extension is wired up once a session exists.
- **Command + event-bus controller**: `activateModelSelect` registers the `/select-model` command and also listens on a cross-extension event ID so external extensions can open the picker without invoking the command directly.
- **Context caching for async triggers**: The most recent `ExtensionContext` is stored (`latestCtx`) so the event-bus handler (which receives no context argument) can still open the dialog.
- **Separation of concerns**:
  - `index.ts`: orchestrates activation, command handling, and applying the selected model.
  - `model-lists.ts`: queries the registry and prepares favourite + searchable model lists.
  - `model-formatter.ts`: pure static utilities for labels, descriptions, sorting, and token formatting.
  - `model-select-dialog.ts`: TUI component that renders the picker and translates user input into selection events.
- **TUI Component pattern**: `ModelSelectDialog` implements `Component` and `Focusable`, rendering itself into lines and delegating focus to an internal `Input` component.
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
   - If the argument can be parsed as `provider/modelId` and resolves through `findExactModel`, the model is applied immediately and the dialog is skipped.

4. **Dialog path**
   - If no exact match is found and a UI is present, the extension loads the `model_select` config.
   - `buildModelLists` refreshes the registry, optionally filters by `provider_filter`, sorts search items with the current model first, and validates configured favourites (collecting warnings for missing models or missing auth).
   - `ctx.ui.custom` creates a `ModelSelectDialog` with the prepared lists, current model, warnings, layout, and an `onDone` callback.
   - The dialog renders two sections (Favourites and Search), a search input, config warnings, and a help footer.

5. **User interaction**
   - Keyboard input is mapped through `keybindings.matches` for navigation, section switching, confirmation, and cancellation.
   - Typing printable characters switches focus to the search input and re-filters the search list via `fuzzyFilter`.
   - Confirming a selection invokes `onDone` with the chosen `Model`.

6. **Apply result**
   - If a model is selected, `applySelectedModel` calls `pi.setModel`.
   - A success or missing-auth notification is shown via `ctx.ui.notify`.

## Integration Points

- **`ExtensionAPI` (`@earendil-works/pi-coding-agent`)**: used to register the command, listen to `session_start`, set the active model (`pi.setModel`), and access the shared event bus (`pi.events`).
- **`ExtensionContext` / `ExtensionCommandContext` (`@earendil-works/pi-coding-agent`)**: provides `modelRegistry`, `ui`, `hasUI`, `model`, and the optional `waitForIdle` guard.
- **`ModelRegistry`**: refreshed and queried for available models, configured auth, and lookup by `provider` + `modelId`.
- **`ConfigLoader` (`../../config-loader`)**: provides feature toggle state (`isEnabled('model_select')`) and the typed `model_select` configuration object.
- **`@earendil-works/pi-ai`**: supplies the `Model<Api>` type and `modelsAreEqual` for stable identity comparisons.
- **`@earendil-works/pi-tui`**: supplies the `Input` component, `fuzzyFilter`, theme helpers, and rendering utilities (`truncateToWidth`, `visibleWidth`) used by the dialog.
- **`pi-vim-keys` / other extensions**: can trigger the picker by emitting `PI_VIM_KEY_EVENT_ID` on the shared event bus.
- **Configuration schemas**: `model_select` shape and `ModelSelectLayout` are defined by `../../schemas/config.schema` and `../../schemas/model-select.config.schema`.
