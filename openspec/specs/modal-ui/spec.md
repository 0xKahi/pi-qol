# Modal UI Specification

## Purpose

Provide a shared, self-contained modal dialog library for building consistent TUI modals — tabbed shells, pluggable navigation, list selection, previews, and framing — so Pi extensions can add new modals without rewriting modal plumbing.

## Requirements

### Requirement: Modal dialog shell
The library SHALL provide a modal dialog component implementing the host `Component` and `Focusable` contracts, constructed with the host `TUI`, `Theme`, and `KeybindingsManager`, that renders supplied tab content, routes keyboard input, and resolves a result through a completion callback. Cancelling SHALL resolve the configured cancel value; confirming a selection SHALL resolve the selected value.

#### Scenario: Dialog renders through the host custom-UI API
- **WHEN** an extension opens the dialog via the host custom-UI API
- **THEN** the dialog renders within the host-provided width and reports focus through the `Focusable` contract

#### Scenario: Cancel resolves the cancel value
- **WHEN** the user triggers dismissal with no open layers
- **THEN** the dialog completes with its configured cancel value

#### Scenario: Confirm resolves the selected value
- **WHEN** the user confirms an item in the active tab
- **THEN** the dialog completes with that item's value

### Requirement: Tab management
The dialog SHALL display one or more tabs in a tab strip, SHALL cycle tabs forward and reverse on `Tab` and `Shift+Tab`, SHALL retain each tab's state across switches, and SHALL route non-tab input only to the active tab.

#### Scenario: Forward and reverse cycling
- **WHEN** the user presses `Tab` or `Shift+Tab`
- **THEN** the next or previous tab becomes active, wrapping at the ends

#### Scenario: Tab state is retained
- **WHEN** the user navigates, scrolls, or filters in one tab, switches away, and returns
- **THEN** that tab restores the state it held before the switch

#### Scenario: Input goes to the active tab only
- **WHEN** the user presses a key that is not tab cycling
- **THEN** only the active tab observes that input

### Requirement: Pluggable navigation schemes
The dialog SHALL accept a navigation scheme that maps raw key input to semantic navigation actions (step, page, first, last, confirm, dismiss) and SHALL default to a scheme driven by the host keybindings manager when none is supplied. The library SHALL provide a Vim scheme mapping `j/k` plus arrow keys to steps, `Ctrl+u/d` to pages, `gg/G` to boundaries, and `Esc`/`q` to dismissal. A stateful scheme SHALL be reset on tab switches and layer changes. Keys the scheme does not handle SHALL fall through to the active content.

#### Scenario: Default scheme follows host keybindings
- **WHEN** a dialog is created without an explicit navigation scheme
- **THEN** list movement, confirm, and cancel follow the host's configured select keybindings

#### Scenario: Vim scheme navigation
- **WHEN** a dialog uses the Vim scheme and the user presses `j`, `k`, `Ctrl+d`, `Ctrl+u`, `gg`, or `G`
- **THEN** the active content receives the corresponding step, page, or boundary action

#### Scenario: Unhandled keys fall through
- **WHEN** the user presses a key the scheme does not map
- **THEN** the active tab receives the raw key

#### Scenario: Pending chord resets on context change
- **WHEN** the user presses `g` and then switches tab or a layer opens or closes
- **THEN** the pending `gg` chord does not carry into the new context

### Requirement: List navigation bounds
The library SHALL provide list-selection state that clamps at list boundaries by default and SHALL offer an opt-in wrap-around mode per list.

#### Scenario: Clamp at boundaries
- **WHEN** a list uses default bounds and the user steps past the first or last item
- **THEN** the selection stays at the boundary item

#### Scenario: Wrap around boundaries
- **WHEN** a list enables wrap mode and the user steps past the last item
- **THEN** the selection moves to the first item, and vice versa

### Requirement: Input layer stack
The dialog SHALL maintain a stack of input layers above the active tab. While a layer is open it SHALL receive navigation actions and raw keys instead of the tab, and dismissal SHALL close the topmost layer before it can close the dialog.

#### Scenario: Dismissal closes the layer first
- **WHEN** a layer is open and the user triggers dismissal
- **THEN** the layer closes and the dialog remains open

#### Scenario: Dismissal with no layers closes the dialog
- **WHEN** no layer is open and the user triggers dismissal
- **THEN** the dialog completes with its cancel value

### Requirement: Scrollable preview layer
The library SHALL provide a preview layer that renders wrapped text with step, page, and boundary scrolling driven by navigation actions.

#### Scenario: Preview scrolls by navigation action
- **WHEN** a preview layer is open and the user triggers step, page, or boundary navigation
- **THEN** the preview scrolls accordingly without affecting the underlying tab's selection

### Requirement: Coordinated modal presentation
The library SHALL provide a shared presentation abstraction accepting an `inline` or `overlay` layout and SHALL coordinate the dialog frame with the host custom-UI mounting options. Inline layout SHALL use an inline frame without overlay mounting. Overlay layout SHALL use a bordered frame and centered overlay mounting with shared defaults. Consumers SHALL be able to retain independent dialog height policies in either layout.

#### Scenario: Present inline modal
- **WHEN** a consumer opens a modal with layout set to `inline`
- **THEN** the modal uses the inline frame
- **AND THEN** the host mounts it in the normal custom-UI flow without overlay options

#### Scenario: Present overlay modal
- **WHEN** a consumer opens a modal with layout set to `overlay`
- **THEN** the modal uses the bordered frame
- **AND THEN** the host mounts it as a centered overlay using the shared width and margin defaults

#### Scenario: Preserve independent height policy
- **WHEN** a height-bounded modal is opened using either supported layout
- **THEN** its configured height bound remains in effect

#### Scenario: Existing Model Select presentation is preserved
- **WHEN** Model Select opens using either its inline or overlay layout
- **THEN** its frame and host mounting behavior remain equivalent to the behavior before adoption of the shared presentation abstraction

### Requirement: Framing styles
The dialog SHALL support an inline frame that draws horizontal rules above and below the content, a bordered frame that draws a rounded border around the content for use with host overlay centering, and an optional bounded-height policy that limits content height to a fraction of the terminal.

#### Scenario: Inline frame
- **WHEN** the dialog uses the inline frame
- **THEN** content renders between full-width horizontal rules

#### Scenario: Bordered frame
- **WHEN** the dialog uses the bordered frame
- **THEN** content renders inside a rounded border sized to the host-provided width

#### Scenario: Bounded height
- **WHEN** the dialog configures a bounded height
- **THEN** tab content is constrained to that height while remaining usable on short terminals

### Requirement: Optional shared filter input
The dialog SHALL support an optional text-filter input rendered between the tab strip and tab content. The filter SHALL receive printable input not claimed by the navigation scheme, SHALL notify tabs of query changes, and SHALL retain one shared query across tabs.

#### Scenario: Typing filters the active view
- **WHEN** the dialog has a filter and the user types printable characters
- **THEN** the query updates and filter-aware tabs re-filter their items

#### Scenario: Query persists across tab switches
- **WHEN** the user types a query, switches tab, and returns
- **THEN** the same query remains in effect

### Requirement: Notices slot
The dialog SHALL support a list of notice lines rendered between the tab strip and tab content, visually distinguished as warnings.

#### Scenario: Notices are displayed
- **WHEN** the dialog is configured with notices
- **THEN** they render above tab content in warning styling

### Requirement: Width-aware tab strip
The tab strip SHALL render tab labels with the active label highlighted, SHALL truncate with leading and trailing omission indicators when labels exceed the available width, and SHALL keep the active label visible. Tab labels SHALL be evaluated on each render so counts or state can change dynamically.

#### Scenario: Labels fit
- **WHEN** all tab labels fit the render width
- **THEN** all labels render with the active label highlighted

#### Scenario: Labels overflow
- **WHEN** all tab labels cannot fit the render width
- **THEN** the strip shows a window of labels around the active tab with omission indicators

#### Scenario: Dynamic label content
- **WHEN** a tab's label text changes between renders
- **THEN** the strip shows the updated text on the next render

### Requirement: Help footer
The dialog SHALL render a help footer composed of the active tab's key hints plus universal dialog hints.

#### Scenario: Hints reflect the active tab
- **WHEN** the user switches tabs
- **THEN** the footer shows the newly active tab's hints

### Requirement: Self-contained distribution
The library SHALL import only from Pi host packages and SHALL NOT import from any plugin-specific module, so the library directory can be copied unchanged into another Pi plugin project.

#### Scenario: Dependency audit
- **WHEN** the library's source files are audited for imports
- **THEN** every import resolves to a Pi host package or within the library directory

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
