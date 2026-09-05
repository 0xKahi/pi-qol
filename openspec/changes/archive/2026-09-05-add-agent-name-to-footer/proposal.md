## Why

The custom footer identifies the active project, session, and model, but it cannot show which external agent or role currently owns the session. A compact, event-driven agent badge would make that identity visible while allowing coordinating extensions to update it at runtime.

## What Changes

- Add an optional bold, inverse-styled agent-name badge with one padded space on each side before the directory segment on the footer's first line.
- Add `custom_footer.display.agentName`, disabled by default, plus `custom_footer.defaultAgentName`, defaulting to `"DEFAULT"`.
- Add optional `custom_footer.colors.agentName` truecolor configuration, with Pi's accent theme as the fallback.
- Listen for `pi.qol.event:set-agent-name` events so other extensions can update the displayed name and optionally its color.
- Validate, sanitize, trim, and width-limit agent names and validate event-provided colors before rendering.
- Reset event-provided agent identity state to configured defaults on each session start.

## Capabilities

### New Capabilities
- `custom-footer-agent-name`: Configurable rendering, runtime event updates, validation, fallback styling, truncation, and session reset behavior for the footer agent-name badge.

### Modified Capabilities

None.

## Impact

- Footer configuration schemas, defaults, inferred types, generated JSON Schema, and README configuration documentation.
- Custom-footer registration, runtime state, first-line rendering, and render invalidation.
- Public cross-extension event contract on `pi.events` using `pi.qol.event:set-agent-name`.
- Custom-footer schema, rendering, sanitization, event, reset, color, and truncation tests.
