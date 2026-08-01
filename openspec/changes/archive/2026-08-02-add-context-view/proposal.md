## Why

pi-qol does not currently provide an interactive way to inspect what occupies the active model context or which hidden prompt, tool, skill, context-file, and extension contributions were injected. The existing MIT-licensed `pi-context-view` plugin provides this analysis, but its separate command views and page-oriented controls do not fit pi-qol's tabbed, Vim-friendly interaction patterns.

## What Changes

- Add an optional `context_view` extension, disabled by default through pi-qol configuration.
- Fork and adapt the context capture, measurement, usage classification, proportional map, injection hierarchy, and preview behavior from Dmitry Makarov's `pi-context-view` plugin.
- Add a single argument-free `/context-view` command that opens one bounded half-height inline interface with Usage and Injections tabs, defaulting to Usage.
- Support `Tab` and `Shift+Tab` tab cycling while preserving each tab's navigation, preview, zoom, and scroll state.
- Add Vim-friendly navigation: `j`/`k` for single-step movement, `Ctrl+u`/`Ctrl+d` for page movement, `gg`/`G` for start/end, Enter for preview, and Esc/q for back or close.
- Add activation through the `pi.vimKeys.event:pi-qol.context_view` event using the same latest-context event bridge pattern as model-select.
- Restructure the fork around pi-qol's registration, controller, pure-domain, and focused UI-module conventions.
- Credit the original plugin and creator in the pi-qol README and describe this version as a Vim-friendly fork.

## Capabilities

### New Capabilities
- `context-view`: Interactive context usage and injection inspection through a configurable, tabbed, Vim-friendly pi-qol extension.

### Modified Capabilities

None.

## Impact

- Adds a new feature module under `src/extensions/context-view/` and corresponding tests.
- Extends top-level configuration schemas, `ConfigLoader`, extension IDs, root registration, generated JSON Schema, and README documentation.
- Subscribes to Pi session, input, agent, message, and context lifecycle events when the feature is enabled; the silent initial-capture probe may create and then filter a synthetic empty turn when no real turn has yet supplied capture data.
- Reuses existing pi-qol peer dependencies (`@earendil-works/pi-coding-agent` and `@earendil-works/pi-tui`) and imports MIT-licensed behavior with attribution to the upstream project.
