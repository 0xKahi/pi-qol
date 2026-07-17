# Model Select Groups

## Purpose

Define grouped favourite tabs, visibility controls, filtering, navigation, and responsive rendering for the model selector.

## Requirements

### Requirement: Group configuration
The system SHALL accept an ordered `model_select.groups` array of non-empty string names that defaults to an empty array, and each `model_select.favourite` entry SHALL accept an optional `groups` array of non-empty strings that defaults to an empty array.

#### Scenario: Groups are omitted
- **WHEN** the user omits both the model-selector group list and a favourite's group memberships
- **THEN** the parsed configuration contains empty arrays for both values

#### Scenario: Groups are configured
- **WHEN** the user configures ordered group names and assigns one or more names to a favourite
- **THEN** the parsed configuration preserves the configured order and memberships

### Requirement: Tab ordering and permanent Favourites tab
The system SHALL accept an optional non-empty `model_select.favourite_label` string that defaults to `Favourites`, SHALL always display the permanent favourites tab using that label as its first tab, SHALL then display unique configured group tabs in first-occurrence configuration order, and SHALL display Search last when Search is visible. The configured label SHALL affect presentation only and SHALL NOT change the permanent tab's identity or behavior.

#### Scenario: Favourite label is omitted
- **WHEN** the user does not configure `model_select.favourite_label`
- **THEN** the parsed label and the permanent first tab label are `Favourites`

#### Scenario: Favourite label is customized
- **WHEN** the user configures `model_select.favourite_label` as `Pinned`
- **THEN** the permanent first tab is displayed as `Pinned`

#### Scenario: Favourite label is empty
- **WHEN** the user configures `model_select.favourite_label` as an empty string
- **THEN** configuration validation fails

#### Scenario: Custom label collides with another tab label
- **WHEN** the configured favourite label exactly matches a group name or `Search`
- **THEN** the permanent first tab retains favourites behavior and the other tab retains its own identity and behavior

#### Scenario: All tab types are visible
- **WHEN** the configured groups are `group1`, `group2`, and `group3` and no tabs are hidden
- **THEN** the tabs appear as the configured favourite label, group1, group2, group3, and Search

#### Scenario: No favourites are configured
- **WHEN** the favourite list is empty
- **THEN** the model selector still displays an empty permanent favourites tab using the configured favourite label

#### Scenario: Configured groups contain duplicates
- **WHEN** the configured groups contain the same exact name more than once
- **THEN** the selector displays one tab for that name at the position of its first occurrence

### Requirement: Group membership filtering
Each group tab SHALL contain the successfully resolved and authenticated favourites whose membership arrays exactly include that configured group name, in favourite configuration order.

#### Scenario: Favourite belongs to multiple configured groups
- **WHEN** one favourite declares membership in two configured groups
- **THEN** that model appears in both corresponding group tabs and in Favourites

#### Scenario: Favourite has no group memberships
- **WHEN** a favourite has no group memberships
- **THEN** that model appears in Favourites and does not appear in any group tab

#### Scenario: Membership references an undefined group
- **WHEN** a favourite membership does not exactly match any configured group name
- **THEN** the membership is ignored without producing a configuration error or warning

#### Scenario: Membership differs only by case
- **WHEN** a favourite membership differs in letter case from a configured group name
- **THEN** the membership does not match that group

#### Scenario: Group has no matching available favourites
- **WHEN** a configured group has no successfully resolved and authenticated matching favourites
- **THEN** its tab remains visible with an empty model list

### Requirement: Duplicate favourite handling
The system SHALL preserve first-entry-wins deduplication for favourite models and SHALL NOT merge group memberships from later duplicate declarations.

#### Scenario: Duplicate favourite declarations have different memberships
- **WHEN** the same provider and model id are declared more than once with different group memberships
- **THEN** the model appears once using only the first accepted declaration's memberships

### Requirement: Group and Search visibility
The system SHALL accept optional `model_select.hide_tabs.groups` and `model_select.hide_tabs.search` booleans that each default to `false`, and SHALL NOT provide a configuration control for hiding Favourites.

#### Scenario: Visibility configuration is omitted
- **WHEN** `hide_tabs` or either of its fields is omitted
- **THEN** configured group tabs and Search are visible by default

#### Scenario: Group tabs are hidden
- **WHEN** `hide_tabs.groups` is true
- **THEN** all configured group tabs are omitted while Favourites remains visible

#### Scenario: Search is hidden
- **WHEN** `hide_tabs.search` is true
- **THEN** Search is omitted while Favourites remains visible

#### Scenario: All optional tabs are hidden
- **WHEN** both `hide_tabs.groups` and `hide_tabs.search` are true
- **THEN** Favourites is the sole visible tab

### Requirement: Search and provider filter independence
The system SHALL continue to apply `provider_filter` only to Search and SHALL NOT use it to remove models from Favourites or group tabs.

#### Scenario: Group favourite uses a filtered-out provider
- **WHEN** an available authenticated favourite belongs to a configured group but its provider is excluded from `provider_filter`
- **THEN** the model remains visible in Favourites and that group but is absent from Search

### Requirement: Dynamic tab navigation and filtering
The selector SHALL cycle forward through visible tabs in display order when the user presses Tab, SHALL cycle backward through visible tabs in reverse display order when the user presses Shift+Tab, SHALL wrap in both directions, and SHALL apply its shared input query to the models in the permanent favourites, group, and Search tabs.

#### Scenario: Forward tab navigation skips hidden tab kinds
- **WHEN** the user presses Tab while groups or Search are hidden
- **THEN** focus advances only among the visible tabs and wraps from the last visible tab to the first

#### Scenario: Backward tab navigation skips hidden tab kinds
- **WHEN** the user presses Shift+Tab while groups or Search are hidden
- **THEN** focus moves backward only among the visible tabs and wraps from the first visible tab to the last

#### Scenario: Query is retained across tabs
- **WHEN** the user enters a filter query and switches between visible tabs in either direction
- **THEN** each tab displays its own models filtered by the same query

#### Scenario: Initial query with visible Search
- **WHEN** the picker opens with a non-exact initial query and Search is visible
- **THEN** Search is initially active and filtered by that query

#### Scenario: Initial query with hidden Search
- **WHEN** the picker opens with a non-exact initial query and Search is hidden
- **THEN** the permanent favourites tab is initially active and filtered by that query

### Requirement: Width-aware tab rendering
The selector SHALL render the tab strip within the terminal width and SHALL keep a visible representation of the active tab when the complete tab sequence does not fit.

#### Scenario: Tab sequence exceeds available width
- **WHEN** configured tab labels exceed the width available to the tab strip
- **THEN** the rendered line remains within the supplied width, the active tab remains represented, and omitted tabs are indicated

#### Scenario: User activates an off-screen tab
- **WHEN** tab navigation activates a tab that was previously outside the rendered tab viewport
- **THEN** the viewport updates so the newly active tab is represented
