## 1. Shared Modal Presentation

- [x] 1.1 Add and export a generic modal presenter plus `ModalLayout` type that maps inline layout to an inline frame without overlay mounting and overlay layout to a bordered, centered 85%-width overlay with one-cell margin.
- [x] 1.2 Add modal-library tests covering both layout mappings, result forwarding, and compatibility with independently configured dialog height policies.
- [x] 1.3 Keep the modal dependency audit passing with the new host-facing presenter.

## 2. Consumer Migration

- [x] 2.1 Migrate Model Select opening and dialog construction to the shared presenter, removing its duplicated frame/overlay mapping while preserving existing behavior.
- [x] 2.2 Update Model Select tests to verify inline and overlay presentation remain unchanged.

## 3. Context View Configuration and Presentation

- [x] 3.1 Extend full and partial Context View schemas with `layout: 'inline' | 'overlay'`, defaulting the full configuration to `inline`, and add valid/default/invalid schema tests.
- [x] 3.2 Route Context View command and Vim-event openings through the shared presenter using the loaded layout configuration.
- [x] 3.3 Update `ContextViewDialog` to accept the presenter-resolved frame while retaining `height: 'half'` in both layouts.
- [x] 3.4 Add registration and dialog tests covering default inline presentation, centered bordered overlay presentation, and the retained half-height bound.

## 4. Documentation and Generated Artifacts

- [x] 4.1 Document `context_view.layout` and its inline default/overlay behavior in README configuration examples and reference tables.
- [x] 4.2 Regenerate `assets/config.schema.json` and verify it exposes the Context View layout enum and default.
- [x] 4.3 Update affected repository, modal-library, Model Select, Context View, schema, and asset codemaps to describe the shared presenter and configurable layout flow.

## 5. Verification

- [x] 5.1 Run the focused modal, Model Select, and Context View test suites and fix regressions.
- [x] 5.2 Run formatting/lint checks, type checking, the full test suite, and strict OpenSpec validation for the change.
