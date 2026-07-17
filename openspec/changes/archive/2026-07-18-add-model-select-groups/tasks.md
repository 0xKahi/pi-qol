## 1. Configuration Model

- [x] 1.1 Extend the model-select Zod schemas with ordered top-level groups, per-favourite group memberships, and defaulted `hide_tabs.groups` and `hide_tabs.search` fields while keeping Favourites non-hideable.
- [x] 1.2 Update top-level model-select defaults and add schema/config tests covering omitted values, configured memberships, invalid empty names, and visibility defaults.
- [x] 1.3 Regenerate `assets/config.schema.json` from the updated canonical Zod schema and verify the generated properties and defaults.

## 2. Group List Preparation

- [x] 2.1 Generalize model-select list types to represent ordered group lists and dynamic tab identities without collisions between built-in labels and user group names.
- [x] 2.2 Update favourite resolution to derive exact, case-sensitive group subsets in favourite order, silently ignore undefined memberships, deduplicate configured groups by first occurrence, and retain first-entry-wins favourite handling.
- [x] 2.3 Extend model-list tests for multi-group membership, ungrouped favourites, unknown and case-mismatched memberships, duplicate groups, duplicate favourites, empty groups, authentication, and provider-filter independence.

## 3. Dynamic Dialog Tabs

- [x] 3.1 Replace binary Favourites/Search dialog state with ordered visible tab state that always starts with Favourites and conditionally includes group and Search tabs.
- [x] 3.2 Implement tab cycling, per-tab selection indices, shared query filtering across every tab, and initial-query behavior for visible versus hidden Search.
- [x] 3.3 Generalize tab content rendering for empty and populated Favourites, group, and Search views while preserving favourite warnings and model selection details.
- [x] 3.4 Implement a width-aware tab-strip viewport that keeps the active tab represented, marks omitted tabs, and never exceeds the supplied render width.
- [x] 3.5 Add dialog tests covering ordering, visibility combinations, permanent empty Favourites, navigation/wrapping, shared filtering, selection, built-in-label collisions, and constrained-width rendering.

## 4. Runtime Integration and Documentation

- [x] 4.1 Pass grouped lists and tab visibility configuration from the model-select command integration into the generalized dialog.
- [x] 4.2 Update `README.md` configuration examples, option tables, behavior notes, and shallow-merge guidance for groups, favourite memberships, and hide controls.
- [x] 4.3 Update affected codemaps to describe dynamic grouped tabs and the revised model-select data flow.

## 5. Verification

- [x] 5.1 Run the model-select and configuration test suites and resolve regressions.
- [x] 5.2 Run formatting/lint checks and TypeScript type checking.
- [x] 5.3 Validate the OpenSpec change and confirm generated schema and documentation examples agree with the implemented configuration contract.
