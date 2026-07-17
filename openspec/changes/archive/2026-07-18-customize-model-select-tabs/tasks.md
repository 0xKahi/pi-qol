## 1. Configuration

- [x] 1.1 Add `favourite_label` to the full and partial model-select Zod schemas, including the `Favourites` full-config default and non-empty validation.
- [x] 1.2 Extend model-select configuration tests to cover defaulting, custom labels, partial overrides, and rejection of empty labels.

## 2. Model Selector Dialog

- [x] 2.1 Pass the configured favourite label through `DialogOptions` and the model-select controller, and render it on the permanent favourites tab without changing tab identity.
- [x] 2.2 Add directional tab switching so Tab cycles forward and Shift+Tab cycles backward through visible tabs with wrapping, and update the contextual help hint.
- [x] 2.3 Extend dialog tests for custom-label rendering and identity collisions, backward wrapping and hidden-tab behavior, query retention, and updated help text.

## 3. Documentation and Generated Assets

- [x] 3.1 Document `model_select.favourite_label` and bidirectional tab navigation in `README.md`.
- [x] 3.2 Run `bun run buildSchema` and verify `assets/config.schema.json` includes the new field and default.

## 4. Verification

- [x] 4.1 Run the focused model-select tests and resolve any failures.
- [x] 4.2 Run `bun run type-check`, `bun run lint`, and the full `bun test` suite.
