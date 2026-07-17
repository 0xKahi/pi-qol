## Context

The model selector constructs a permanent favourites tab first, followed by configured group tabs and optional Search. Its visible label is currently hard-coded in `ModelSelectDialog`, and the dialog only recognizes the configured `tui.input.tab` action to advance through tabs. Configuration is schema-first: full and partial Zod schemas feed typed runtime config, and the JSON Schema asset is generated from those definitions.

## Goals / Non-Goals

**Goals:**

- Add a validated, optional `model_select.favourite_label` setting whose parsed default is `Favourites`.
- Carry that label into the dialog and use it only for presentation of the permanent favourites tab.
- Make Shift+Tab move backward through visible tabs with the same wrapping behavior as forward Tab.
- Keep configuration documentation, generated schema, and tests synchronized.

**Non-Goals:**

- Renaming the internal favourites tab identity or changing favourites data semantics.
- Making group or Search labels configurable.
- Adding a new global Pi keybinding action or changing Pi's application-level Shift+Tab behavior outside the focused dialog.
- Changing tab ordering, visibility, filtering, or selection persistence.

## Decisions

### Validate `favourite_label` as a non-empty string with a schema default

Add `favourite_label` to both the full and partial model-select schemas. The full schema defaults it to `Favourites`; the partial schema leaves it optional so layered configuration does not materialize a lower-precedence default prematurely. Reuse the existing non-empty-name string constraint so an unusable blank label is rejected.

An alternative was to accept any string and fall back at render time. Schema validation is preferred because configuration behavior remains explicit and the dialog receives a concrete typed value.

### Treat the custom label as presentation only

Add `favouriteLabel` to `DialogOptions`, pass `config.favourite_label` from the model-select controller, and use it only when creating the tab definition. Keep `TabIdentity` as `{ kind: 'favourites' }`, preserving warning placement, empty-state behavior, first-tab ordering, and collision safety when group labels equal the custom label.

An alternative was to derive identity from labels. That would reintroduce collisions with group names and couple behavior to user-facing text.

### Use directional tab switching and direct Shift+Tab recognition

Change tab switching to accept a direction (`1` or `-1`) and use the existing wrap-index logic or equivalent modular arithmetic. Continue using `KeybindingsManager` for forward `tui.input.tab`, but recognize the literal `shift+tab` terminal key with `matchesKey` from `@earendil-works/pi-tui` before delegating input to the search field.

There is no dedicated reverse-tab TUI action in Pi's keybinding registry. Reusing `app.thinking.cycle` would couple dialog navigation to an unrelated application action and to user remapping of thinking controls. Direct matching provides the requested Shift+Tab behavior within the focused model-selector dialog without affecting global input handling.

### Reflect both directions in contextual help

When multiple tabs are visible, change the tab hint to communicate Tab and Shift+Tab navigation. Suppress the hint when only the permanent favourites tab is visible, matching current behavior.

## Risks / Trade-offs

- [Some terminals encode Shift+Tab differently] → Use Pi TUI's `matchesKey` utility, which normalizes supported terminal key sequences.
- [A very long custom label reduces the number of visible tabs] → Rely on the existing width-aware viewport and truncation behavior, and add coverage using a custom label.
- [The fixed Shift+Tab shortcut is not user-remappable within this extension] → Keep scope to the explicitly requested shortcut; a dedicated configurable reverse-tab action would require host-level keybinding support.
- [Defaults can diverge between nested and top-level schemas] → Update schema tests and regenerate `assets/config.schema.json` from the canonical Zod schema.
