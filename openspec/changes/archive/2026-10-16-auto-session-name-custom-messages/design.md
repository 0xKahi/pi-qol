# Design

## Context

Pi >=1.2 changed `before_agent_start` into a union discriminated by `messageType` (`'user'` with `prompt`, `'custom'` with `message`), emitted before the starting message is appended to the branch. The previous implementation read only `event.prompt` and counted prior user entries with an ad-hoc emptiness check. See proposal.md for motivation.

## Goals / Non-Goals

**Goals:**
- One entry point (`before_agent_start`) for both run types.
- One definition of "has naming text" shared by the current-run check and the branch-history check.

**Non-Goals:**
- Supporting Pi <1.2 event shapes.
- Naming from non-triggering custom messages (`triggerTurn: false`), which do not start a run.

## Decisions

- **Hook `before_agent_start`, not `message_start`.** The event fires for both user and custom runs before the message is persisted, so "no prior naming entries" equals "this is the first". The earlier `message_start` attempt was unreliable and is removed.
- **`resolveNamingText` runs before session guards.** Cheap, event-local rejection (disabled, non-whitelisted, empty) avoids touching session state for irrelevant runs.
- **Shared `hasNamingText` predicate** (`parseAgentContentToPrompt(content).trim() !== ''`). Alternative considered: keep the old structural emptiness check for history. Rejected because it disagreed with extraction (whitespace and image-only messages counted as "real"), letting a message that could not name the session permanently block naming.
- **Whitelist as `ReadonlySet`** built per event from config, so config reloads take effect immediately.
- **Explicit `PartialAutoSessionNameConfigSchema`** instead of `.partial()`, because Zod's `.partial()` keeps `.default([])`, which would inject `[]` into every partial layer and overwrite the other layer during merge.

## Risks / Trade-offs

- [Running on Pi <1.2 would mis-detect events] → Feature is documented as Pi >=1.2; dev deps target `^1.3.0`.
- [An extension may emit a whitelisted custom message with only images first] → It no longer blocks naming; the next message with text names the session.
