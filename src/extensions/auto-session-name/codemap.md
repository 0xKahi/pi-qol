# src/extensions/auto-session-name/

## Responsibility

Generate and apply a short, descriptive name from the first eligible user prompt or whitelisted custom-message run (Pi >=1.2). The branch must have no prior non-empty user messages or whitelisted custom messages, no session name may already be set, and the session must not be a child/fork. Generated titles are applied through the normal Pi session name API (`setSessionName`) so they appear in the UI and persist with the session.

## Design Patterns

- **Event-driven extension registration**: `registerAutoSessionName` attaches handlers to Pi lifecycle events (`session_start`, `before_agent_start`, `session_shutdown`) and coordinates state across them.
- **Guard object**: `AutoSessionNameGuard` isolates all preconditions (enabled check is kept in the caller) so the main flow reads as a simple chain of boolean decisions.
- **Static command object**: `AutoSessionNameTitleGenerator` encapsulates the entire LLM-backed title generation as a single static entry point with pure helper methods for extraction, cleaning, and truncation.
- **Prompt-as-data**: `prompt.ts` builds a `Context` value object containing a detailed system prompt and a single user message; no prompt logic leaks into the generator.
- **Dependency injection by structural typing**: All collaborators are accepted as `Pick<...>` or local interfaces, and the LLM call is optionally parameterized by `completeFn`, making the extension easy to unit test and minimizing coupling to the full ExtensionAPI surface.
- **Cancellation token**: A module-level `AbortController` is created per title request. It is aborted before a newer request starts, on `session_shutdown`, and propagated into the LLM completion so stale completions cannot overwrite the session name.
- **Defensive post-condition check**: After applying the title, the code compares `pi.getSessionName()` with the generated text and warns if they diverge.

## Data & Control Flow

1. **Session start**: The `session_start` handler records `event.reason` in `lastSessionStartReason`.
2. **Agent start trigger**: On `before_agent_start`, the handler first verifies:
   - `auto_session_name` is enabled in config.
   - No session name is currently set (`getSessionName() !== undefined`).
   - The session is not a child/fork (`startReason !== 'fork'` and no `parentSession` header).
   - `resolveNamingText` accepts a non-empty user prompt or custom message with a `customType` in `custom_message_whitelist`, extracting text and ignoring images. Ineligible runs return before session guards.
   - `isFirstNamingTurn` finds no prior user or whitelisted custom messages with text in the branch (same `hasNamingText` rule as `resolveNamingText`, so blank/image-only entries never block naming). Pi emits the event before appending the starting message for both run types.
3. **Cancellation of stale request**: Any existing `titleController` is aborted and replaced with a fresh `AbortController` for this request.
4. **Model resolution**: `ModelResolver` resolves the configured title model (or the default fallback) into a concrete `ResolvedModel` (model, API key, headers, reasoning preference). Errors are surfaced via `ctx.ui.notify`.
5. **Title generation**: `AutoSessionNameTitleGenerator.generateAndApplyTitle` sends a single-turn completion to the LLM using the context from `buildTitleContext`. The call carries `maxRetries`, `maxTokens`, and the abort signal.
6. **Title cleaning**: The raw response has `<think>` blocks stripped, is reduced to the first non-empty line, has surrounding quotes removed, and is truncated to `MAX_TITLE_LENGTH`.
7. **Application**: The cleaned title is applied via `pi.setSessionName`. If application fails or returns a different value, a warning is shown.
8. **Feedback**: Success or failure is reported through `ctx.ui.notify`.
9. **Cancellation/reset**: `session_shutdown` aborts any pending request and clears the controller.

## Integration Points

- **Pi ExtensionAPI**:
  - Events: `session_start`, `session_shutdown`, `before_agent_start`.
  - Methods: `getSessionName`, `setSessionName`.
- **Pi Context/session manager** (`ctx.sessionManager`):
  - `getBranch()` and `getHeader()` are used to detect the first eligible naming turn and child sessions.
- **ConfigLoader** (`../../config-loader`):
  - `isEnabled('auto_session_name')` toggles the feature.
  - `getAutoSessionName()` supplies the optional per-feature model override and custom message whitelist (empty by default).
- **ModelResolver** (`../../utils/model-resolver.util`):
  - Resolves the configured model string into a full `ResolvedModel` usable by `pi-ai`.
- **pi-ai compat** (`@earendil-works/pi-ai/compat`):
  - `completeSimple` performs the actual LLM completion.
- **Pi UI notifications** (`ctx.ui.notify`):
  - All user-facing status, warnings, and errors are emitted through the Pi notification channel.
- **Web/Node `AbortController`**:
  - Used to cancel in-flight LLM completion requests.

(End of file)
