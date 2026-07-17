## Context

The model selector currently prepares two flat lists (`favouriteItems` and `searchItems`) and the dialog hard-codes a binary `favourites | search` section state. Favourite configuration metadata is discarded after each model is resolved, so group membership cannot be represented by the dialog today. The change spans schema defaults, list preparation, dynamic TUI navigation/rendering, generated schema, documentation, and tests.

The existing behaviours that constrain the design are:

- Favourite models are resolved in configuration order, require configured authentication, and are deduplicated by provider/model id with the first accepted declaration winning.
- `provider_filter` constrains Search only.
- One shared input query filters the current Favourites and Search lists.
- Configuration sections are shallow-merged, and arrays replace lower-precedence arrays.
- Every rendered TUI line must fit the supplied width.

## Goals / Non-Goals

**Goals:**

- Let users define ordered, named tabs that filter their configured favourites.
- Keep Favourites permanently available as the complete favourite-model view.
- Allow all custom group tabs or the Search tab to be hidden independently.
- Generalize the dialog from two hard-coded sections to an ordered collection of visible tabs.
- Preserve existing favourite resolution, authentication, deduplication, filtering, and selection behaviour.
- Make dynamic tab rendering usable at narrow terminal widths.

**Non-Goals:**

- Groups do not contain arbitrary registry models that are absent from `favourite`.
- Groups do not affect `provider_filter`, authentication, model sorting, or exact command-argument selection.
- Duplicate favourite declarations do not merge group memberships.
- This change does not add per-group visibility controls, group renaming, nested groups, or runtime group editing.
- This change does not alter the repository's configuration merge strategy.

## Decisions

### Configuration uses ordered group names and optional membership arrays

Add `model_select.groups` as an array of non-empty strings defaulting to `[]`. Extend each favourite entry with `groups`, an optional array of non-empty strings defaulting to `[]`. Matching is exact and case-sensitive.

A string-array representation is intentionally lightweight and keeps tab order explicit. A map of group names to models was rejected because it would duplicate model declarations and make Favourites harder to maintain as the canonical list.

### Favourites is permanent; visibility controls cover groups and Search only

Add `model_select.hide_tabs` with optional `groups` and `search` booleans, each defaulting to `false`. There is no `favourites` visibility field. The Favourites tab renders even when it contains zero available models, ensuring the dialog always has at least one valid tab.

One plural `groups` toggle hides all custom group tabs. Per-group controls were rejected as unnecessary configuration complexity.

The new nested object follows the existing section-level shallow merge behaviour. A higher-precedence `hide_tabs` object replaces the lower-precedence object, and final schema defaults fill omitted fields with `false`.

### Group tabs are derived views over resolved favourites

List preparation will retain each accepted favourite's configured membership long enough to build group lists. Favourites continues to contain all successfully resolved and authenticated favourite models. Each visible group contains the subset whose membership array exactly includes that group name, preserving favourite order.

Membership names absent from the top-level `groups` array are ignored without errors or warnings. Favourites without memberships remain available only from Favourites. `provider_filter` continues to apply only to Search.

Duplicate favourite declarations preserve current first-entry-wins behaviour. Membership from later duplicate declarations is discarded rather than unioned.

### Duplicate configured groups are normalized at display time

Top-level group names are deduplicated by exact string equality, preserving the first occurrence and overall configuration order. Silently normalizing duplicates avoids indistinguishable tabs without making an otherwise usable configuration fail validation.

### The dialog uses dynamic tab descriptors

Replace binary section switching with an ordered tab collection conceptually shaped as:

```text
Tab = identity + label + kind + items + selectedIndex
kind = favourites | group | search
```

Tabs are constructed in this order:

```text
Favourites -> unique configured groups (unless hidden) -> Search (unless hidden)
```

Tab input cycles through only visible tabs. A shared query is retained and filters Favourites, every group, and Search, preserving the current cross-tab filtering behaviour. An initial non-exact command argument activates Search when Search is visible; otherwise Favourites remains active and the argument filters its items.

Tagged internal identities distinguish built-in tabs from user groups even when a group is named `Favourites` or `Search`.

### The tab strip keeps the active tab visible

The tab renderer will use the available width as a viewport rather than truncating the complete tab sequence blindly. It will prioritize the active tab, include nearby tabs while space permits, and indicate omitted tabs with an ellipsis. Individual labels may be truncated when required by very narrow widths. This preserves keyboard access to all tabs while ensuring the active location remains visible.

## Risks / Trade-offs

- **[Many or long group names can make tabs hard to scan]** → Use an active-centered width-aware viewport with omission indicators.
- **[A group named `Favourites` or `Search` can look like a built-in tab]** → Keep identities tagged internally; allow the label because group names are intentionally user-defined.
- **[Silent group deduplication or ignored memberships can conceal typos]** → Keep behaviour tolerant as requested and document exact, case-sensitive matching.
- **[Project `hide_tabs` overrides can reset global nested values]** → Document that the existing shallow section merge semantics apply; changing merge strategy remains out of scope.
- **[Dynamic tabs increase dialog state complexity]** → Centralize tab state instead of adding separate fields and branches for every tab kind.
