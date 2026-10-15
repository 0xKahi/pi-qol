# Tasks

## 1. Config

- [x] 1.1 Add `custom_message_whitelist` (default `[]`) to `AutoSessionNameConfigSchema`, the root config default, and `assets/config.schema.json`; verify with `test/auto-session-name/config.test.ts`
- [x] 1.2 Define `PartialAutoSessionNameConfigSchema` explicitly so partial layers omit unset keys; verify partial-parse test passes

## 2. Naming text and guards

- [x] 2.1 Add `resolveNamingText` and `hasNamingText` in `naming-text.ts` handling the user/custom event union; verify `test/auto-session-name/naming-text.test.ts`
- [x] 2.2 Replace `isUsersFirstTurn`/`isFirstCustomExtensionMessage` with `isFirstNamingTurn` using `hasNamingText`; verify `test/auto-session-name/guards.test.ts` covers blank/whitespace/image-only entries
- [x] 2.3 Wire `before_agent_start` in `index.ts` (resolve text → session guards → generate) and remove dead `message_start` code; verify `tsc --noEmit` is clean

## 3. Docs and tooling

- [x] 3.1 Update README and extension codemap for the whitelist and guard semantics; verify README config table renders aligned
- [x] 3.2 Bump Pi dev deps to `^1.3.0` and TypeScript to `^7` (add `types: ["bun"]`); verify `bun test` and `tsc --noEmit` pass
