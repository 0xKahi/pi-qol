## Why

The model selector currently offers only a flat Favourites tab and the full Search tab, which makes larger favourite lists harder to organize by workflow or purpose. User-defined group tabs provide quicker access to useful subsets while preserving Favourites as the complete, dependable entry point.

## What Changes

- Add an ordered `model_select.groups` configuration array for user-defined group tabs.
- Add an optional `groups` membership array to each `model_select.favourite` entry.
- Always display the Favourites tab, including when no favourites are configured.
- Display unique configured group tabs after Favourites and before Search, preserving the first occurrence and configured order.
- Populate group tabs from matching favourite models; silently ignore memberships that do not match a configured group.
- Add optional `model_select.hide_tabs.groups` and `model_select.hide_tabs.search` controls, both defaulting to `false`; Favourites cannot be hidden.
- Preserve existing first-entry-wins handling for duplicate favourite model declarations.
- Keep the active tab visible when configured groups make the tab strip wider than the available terminal width.
- Update generated configuration schema, documentation, and model-selector tests for the new behavior.

## Capabilities

### New Capabilities
- `model-select-groups`: Defines model-selector group configuration, membership filtering, tab ordering and visibility, navigation, and empty/overflow behavior.

### Modified Capabilities

None.

## Impact

- Configuration schemas and generated `assets/config.schema.json`.
- Model-list preparation and model-selector dialog state/rendering.
- Public `model_select` configuration documented in `README.md`.
- Tests for schema defaults, group list construction, tab visibility/order, duplicate handling, navigation, and rendering at constrained widths.
- No new runtime dependencies or external API integrations.
