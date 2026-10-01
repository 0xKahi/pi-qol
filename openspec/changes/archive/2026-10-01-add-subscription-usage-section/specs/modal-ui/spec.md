# Spec Delta

## ADDED Requirements

### Requirement: Sectioned modal shell
The library SHALL provide a sectioned modal component implementing the host `Component` and `Focusable` contracts. It SHALL host one or more sections, each an embedded modal dialog with its own tabs, navigation scheme, optional filter, title, notices, and hints. Exactly one section SHALL be active at a time, and the first section SHALL be active on open unless an initial section is configured. When any section completes with a value, the whole sectioned modal SHALL complete with that value. When the user dismisses with no open layer in the active section, the whole sectioned modal SHALL complete with its configured cancel value.

#### Scenario: First section is active on open
- **WHEN** a sectioned modal opens without an initial section configured
- **THEN** the first section's content, tab strip, and hints are rendered

#### Scenario: Section completion resolves the modal
- **WHEN** the active section confirms a value
- **THEN** the sectioned modal completes with that value

#### Scenario: Dismissal from any section closes the modal
- **WHEN** the active section has no open layer and the user triggers dismissal
- **THEN** the sectioned modal completes with its cancel value

#### Scenario: Dismissal closes a section layer first
- **WHEN** the active section has an open layer and the user triggers dismissal
- **THEN** that layer closes and the sectioned modal remains open on the same section

### Requirement: Section switching keys
The sectioned modal SHALL switch to the next section on `Ctrl+]` and to the previous section on `Ctrl+[`, wrapping in both directions, before any other input routing. A bare `\x1b` byte SHALL always be treated as Esc and passed to the active section, never treated as a section switch. `Ctrl+[` SHALL switch sections only when the terminal reports it as a separate key sequence. `Tab` and `Shift+Tab` SHALL continue to cycle tabs inside the active section. Switching sections SHALL reset any pending navigation chord in the section being left. With a single section, the section switching keys SHALL do nothing.

#### Scenario: Next section with wrap
- **WHEN** the last section is active and the user presses `Ctrl+]`
- **THEN** the first section becomes active

#### Scenario: Previous section with a disambiguated key
- **WHEN** the terminal reports `Ctrl+[` as a separate key sequence and the user presses it on the first section
- **THEN** the last section becomes active

#### Scenario: Bare Esc is never a section switch
- **WHEN** the modal receives a bare `\x1b` byte
- **THEN** the active section handles it as Esc and the active section does not change

#### Scenario: Tab stays inside the section
- **WHEN** the user presses `Tab` or `Shift+Tab`
- **THEN** the active section's tabs cycle and the active section does not change

#### Scenario: Pending chord does not leak across sections
- **WHEN** the user presses `g` in a Vim-navigated section and then switches section and back
- **THEN** no pending `gg` chord remains in effect

### Requirement: Section state retention
Each section SHALL keep its active tab, selections, scroll positions, filter query, and open layers while other sections are active, and SHALL restore them when it becomes active again. Input SHALL reach only the active section.

#### Scenario: Filter query survives a section round-trip
- **WHEN** the user types a query in a filtered section, switches to another section, and switches back
- **THEN** the same query and filtered results are shown

#### Scenario: Inactive sections receive no input
- **WHEN** the user presses keys while a section is active
- **THEN** no other section observes that input

### Requirement: Frame-embedded section strip
The sectioned modal SHALL render section labels inside the top horizontal rule when using the inline frame, and inside the top border when using the bordered frame, without adding a content line. The active section label SHALL be highlighted with accent and bold styling, and inactive labels SHALL be muted. When all labels cannot fit the available width, the strip SHALL keep the active label visible and indicate that labels were omitted. The active section's own tab strip SHALL continue to render inside the body, so section labels and tab labels are visually distinct.

#### Scenario: Inline frame section strip
- **WHEN** a sectioned modal renders with the inline frame
- **THEN** its first line is a horizontal rule containing the section labels, with the active label highlighted

#### Scenario: Bordered frame section strip
- **WHEN** a sectioned modal renders with the bordered frame
- **THEN** its top border contains the section labels, with the active label highlighted, and stays within the supplied width

#### Scenario: Section strip adds no height
- **WHEN** a dialog is rendered as a section and again as a standalone dialog with the same content and frame
- **THEN** both renders have the same number of lines

#### Scenario: Section labels overflow
- **WHEN** the section labels cannot fit the available width
- **THEN** the rule or border stays within the width, the active label remains visible, and omitted labels are indicated

### Requirement: Section-aware help footer
When a sectioned modal hosts more than one section, the active section's help footer SHALL include a hint for section switching in addition to that section's own hints and the universal dialog hints.

#### Scenario: Section hint is shown
- **WHEN** a sectioned modal with two sections renders any section
- **THEN** the help footer includes a section switching hint

#### Scenario: Hints follow the active section
- **WHEN** the user switches sections
- **THEN** the help footer shows the newly active section's hints

### Requirement: Height follows the active section
The sectioned modal SHALL apply the active section's height policy. A section using natural height SHALL render at its natural content height, even if that changes the modal's height when switching sections.

#### Scenario: Natural-height sections
- **WHEN** two natural-height sections have different content heights and the user switches between them
- **THEN** the modal renders each section at that section's natural height
