## Why

Context View is fixed to an inline presentation while Model Select already offers inline and overlay layouts. Adding the same configuration choice to Context View gives users consistent control over modal presentation, and centralizing layout presentation prevents each modal from separately coordinating its frame with Pi's custom-UI mounting options.

## What Changes

- Add a `context_view.layout` configuration setting accepting `inline` or `overlay`, defaulting to `inline`.
- Open Context View inline or as a centered overlay according to the configured layout while retaining its half-terminal height bound.
- Add a shared modal presentation abstraction that maps semantic layouts to both dialog framing and host custom-UI options.
- Migrate Model Select to the shared presentation abstraction without changing its existing layout behavior.
- Document Context View's layout setting and update generated configuration schema artifacts.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `context-view`: Add configurable inline and overlay presentation with inline as the default.
- `modal-ui`: Add shared presentation behavior that consistently coordinates modal framing with host inline or overlay mounting.

## Impact

- Context View configuration schema, defaults, registration/opening flow, dialog construction, tests, README, and generated JSON Schema.
- Shared modal library API and tests.
- Model Select modal opening flow, with no intended user-visible behavior change.
- No new external dependencies or breaking configuration changes.
