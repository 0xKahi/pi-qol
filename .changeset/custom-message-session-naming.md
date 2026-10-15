---
"@0xkahi/pi-qol": minor 
---

auto_session_name: support naming sessions from extension custom messages (Pi >=1.2)

- Handle the Pi >=1.2 `before_agent_start` user/custom event union. User prompts work as before; custom messages sent with `pi.sendMessage(..., { triggerTurn: true })` can now trigger naming.
- New `auto_session_name.custom_message_whitelist` option (`string[]`, default `[]`). Only custom messages whose `customType` is listed can name a session; the empty default keeps the previous user-prompt-only behavior.
- Naming text is taken from the trimmed prompt, or from a whitelisted custom message's text blocks (images ignored). Blank or image-only messages never trigger naming.
- Fix: blank, whitespace-only, or image-only opening messages no longer permanently block naming. Only earlier user/whitelisted custom messages that contain text count as "already started".
- Fix: project/global partial configs no longer inject a default whitelist that could overwrite the other layer when merged.
- Remove the dead, commented-out `message_start` naming attempt.
- Dev: bump Pi packages to `^1.3.0` and TypeScript to `^7`.
