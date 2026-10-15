# Proposal

## Why

Pi >=1.2 emits `before_agent_start` for both user prompts and extension custom messages sent with `triggerTurn: true`. Sessions started by an extension (for example a command that injects a custom message) never got an auto-generated name, and an earlier attempt to hook `message_start` did not work. Separately, blank or image-only opening messages could permanently block naming because the "is this the first turn?" check used a looser notion of emptiness than the text extraction.

## What Changes

- Add `auto_session_name.custom_message_whitelist` (`string[]`, default `[]`): custom messages whose `customType` is listed may trigger auto session naming. The empty default preserves prior behavior (user prompts only).
- Handle the Pi >=1.2 `before_agent_start` user/custom event union: extract naming text from the user prompt, or from whitelisted custom message content (text blocks joined, images ignored).
- Replace the "user's first turn" guard with a "first naming turn" guard: naming is skipped only when the branch already contains a user message or whitelisted custom message **with non-whitespace text**. Blank and image-only messages no longer block later naming.
- Partial (project/global) config parsing no longer injects the whitelist default, so merging config layers does not clobber a globally configured whitelist.
- Bump dev dependencies to Pi `^1.3.0` and TypeScript `^7`; remove dead commented-out `message_start` code.

## Capabilities

### New Capabilities
- `auto-session-name`: Automatic, one-time, non-blocking naming of new sessions from the first eligible user prompt or whitelisted custom message.

### Modified Capabilities
<!-- none -->

## Impact

- Code: `src/extensions/auto-session-name/{index,guards,naming-text}.ts`, `src/schemas/auto-session-name.config.schema.ts`, `src/schemas/config.schema.ts`.
- Config: new optional key in `assets/config.schema.json`; existing configs remain valid.
- Runtime: requires Pi >=1.2 event shape for `before_agent_start`.
- Docs/tests: README, extension codemap, new tests for naming text, guards, and config parsing.
