## Context

The custom footer is installed from `src/extensions/custom-footer/index.ts` during `session_start`. `CustomFooterComponent` reads live footer/session data and renders the first line in `renderPathLine()`, while footer configuration comes from the Zod schema in `src/schemas/custom-footer-config.schema.ts`. The component already uses ANSI-aware width utilities and `cli-dye` truecolor styling, and other pi-qol features already use `pi.events` for cross-extension activation.

The event bus delivers `unknown` payloads and does not persist events. Agent identity therefore needs explicit runtime validation, render invalidation, and session reset behavior. See `proposal.md` for motivation and `specs/custom-footer-agent-name/spec.md` for observable requirements.

## Goals / Non-Goals

**Goals:**
- Keep agent identity as small, session-scoped state independent of session history.
- Reuse the footer's existing ANSI-aware rendering and truecolor conventions.
- Expose a stable, defensive event contract to extensions loaded in the same Pi runtime.
- Keep the existing first line byte-for-byte equivalent when agent-name display is disabled.

**Non-Goals:**
- Persist event-selected agent identity in the session file or across sessions.
- Add a command or interactive UI for changing the agent name.
- Support color formats other than the project's existing six-digit `#RRGGBB` format.
- Change the footer's existing whole-line truncation policy or its second and third lines.

## Decisions

### 1. Add agent-name settings to the existing custom-footer schema

Extend the full and partial custom-footer schemas with:

- `display.agentName: boolean`, default `false`
- `colors.agentName?: #RRGGBB`
- `defaultAgentName: string`, trimmed, normalized, non-empty, default `"DEFAULT"`

This preserves the existing configuration hierarchy and merge behavior. The partial schema must keep all new fields optional so a project override does not accidentally disable or rename a globally configured badge.

Alternative: create a nested `agentName` object. This would group the fields but diverge from the established `display` and `colors` conventions and make a small feature more cumbersome to configure.

### 2. Isolate mutable identity in a small state controller

Introduce a custom-footer-local state abstraction holding the normalized current name and optional event color. It will expose reset, event-update, snapshot, and change-subscription behavior:

```text
session_start ----------------------> reset(config default)
                                           |
set-agent-name event --> validate --> update state
                                           |
                                           v
                                component requests render
```

`registerCustomFooter` creates the state and registers the event listener early enough to provide one listener per extension runtime. On every `session_start`, it resets state from current validated config before the footer renders. The component subscribes to state changes and removes that subscription in `dispose()`, alongside its existing git-branch subscription.

Alternative: store name and color directly on `CustomFooterComponent`. That couples the public event listener to component installation timing and makes events emitted around session startup easier to lose or route to a disposed component.

### 3. Treat event payloads as untrusted unknown data

The `pi.qol.event:set-agent-name` handler will narrow the payload at runtime. It accepts an object with a string `agentName` and optional string `color`. The name is normalized before the empty-name check. Invalid names reject the entire event; an invalid or absent color does not reject a valid name and instead clears event color so normal fallback applies.

The event contract is:

```ts
pi.events.emit('pi.qol.event:set-agent-name', {
  agentName: 'NewAgentName',
  color: '#FFFFFF',
});
```

The event id should be exported as a named constant to prevent spelling drift in internal code and give tests one canonical channel value.

Alternative: validate event payloads with the configuration Zod schema. A small explicit runtime parser is preferable because event color has fallback semantics rather than configuration-error semantics, and event data is not part of persisted configuration.

### 4. Normalize before styling and truncation

A pure formatter will:

1. strip ANSI escape sequences and unsafe control characters,
2. trim leading and trailing whitespace,
3. reject an empty result,
4. preserve ordinary internal spaces,
5. truncate by terminal-visible width to a ten-column prefix plus `...`.

The same normalization rules apply to configured defaults and event names. Width limiting occurs before inverse/color ANSI styling, avoiding escape sequences in width calculations and preventing malformed style boundaries. Existing `visibleWidth`/`truncateToWidth` utilities should be reused.

Alternative: use `String.slice(0, 10)`. It is simpler but can split Unicode display characters and does not enforce the terminal-column requirement.

### 5. Resolve color on each accepted update, never from stale event state

Color precedence is:

```text
valid current event color
          |
          v
configured colors.agentName
          |
          v
Pi theme foreground "accent"
```

When an accepted event omits or supplies an invalid color, the state stores no event color rather than retaining the previous event color. Session reset also clears event color. This ensures fallback behavior is deterministic.

For a custom hex color, compose `cli-dye` truecolor foreground styling with `dye.bold()` and `dye.inverse()`. Without a custom color, apply `theme.fg('accent', ...)`, then bold and inverse styling. All styling applies to the padded badge content, including one space on each side of the name. Extend the footer's local theme type to include `accent` while retaining its existing colors.

Alternative: convert Pi's accent into a hex value and route every path through `cli-dye`. Pi exposes theme styling functions but not a stable source hex value, so composing the provided theme function is more robust.

### 6. Prefix the existing first-line assembly

`renderPathLine()` will build the existing directory/branch/session string unchanged, then conditionally prefix:

```text
<bold inverse " agent name "><normal space><existing path line>
```

The badge includes one bold, inverse-styled padding space on each side of the normalized name. One additional normal, unstyled space separates the trailing badge padding from the existing path line. The ten-column name limit excludes the two styled padding columns. The combined line continues through the existing final `truncateToWidth()` call, preserving the agent badge as the highest-priority leftmost content on narrow terminals.

Alternative: reserve a fixed region for both badge and directory. This would change existing truncation behavior and add layout complexity beyond the agreed ten-column badge limit.

### 7. Update generated and user-facing contracts together

The source Zod schema remains canonical. Regenerate `assets/config.schema.json`, document the three new options and event example in `README.md`, and cover defaults/partial parsing plus rendering and event behavior in custom-footer tests.

## Risks / Trade-offs

- [An emitter sends a name before session startup completes] -> Register the event listener with runtime state, then make `session_start` reset authoritative; emitters that assign a session identity should emit during or after their own session-start handling.
- [ANSI sanitization misses uncommon terminal escape forms] -> Use an established ANSI-strip utility already available in the rendering stack where possible, then filter remaining control characters before styling.
- [Bold/inverse styling composition resets the selected foreground unexpectedly] -> Add ANSI-enabled tests that strip output for visible text and assert bold, inverse, and expected foreground sequences across the padded badge.
- [A ten-column prefix produces a thirteen-column truncated badge] -> Document and test that the ten-column limit applies before the three-character ellipsis, matching `VERY-LONG-...`.
- [Nested project configuration replaces global `display` or `colors` objects] -> Preserve existing merge semantics and rely on final schema defaults; document the new keys consistently with current configuration behavior.

## Migration Plan

1. Add schema defaults and partial-input support; existing configurations remain valid because display is disabled by default.
2. Add runtime state, event handling, and conditional rendering.
3. Regenerate the published JSON Schema and update documentation.
4. Rollback is safe by reverting the additive schema and footer changes; no persisted agent identity or data migration exists.
