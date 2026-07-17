## MODIFIED Requirements

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
