## Why

The model selector currently hard-codes the Favourites tab label and only supports forward tab cycling, limiting personalization and making keyboard navigation less efficient. Users should be able to name the permanent favourites section and move through tabs in either direction.

## What Changes

- Add an optional `model_select.favourite_label` configuration field with the default value `Favourites`.
- Render the permanent favourites tab using the configured label without changing its identity, position, or visibility.
- Support Shift+Tab to cycle backward through visible model-selector tabs with wrapping, while Tab continues to cycle forward.
- Update generated configuration schema, user documentation, and automated tests for the new configuration and navigation behavior.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `model-select-groups`: Make the permanent favourites tab label configurable and add reverse tab cycling to the existing dynamic tab navigation behavior.

## Impact

- Model-select full and partial Zod configuration schemas and top-level defaults.
- Model-selector dialog options, construction, tab rendering, input handling, and help text.
- Generated `assets/config.schema.json` and README configuration documentation.
- Model-select schema and dialog tests; no dependency or external API changes.
