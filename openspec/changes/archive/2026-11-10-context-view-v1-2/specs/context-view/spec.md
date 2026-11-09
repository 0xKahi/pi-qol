# Spec Delta

## MODIFIED Requirements

### Requirement: Context View feature configuration
The system SHALL expose `context_view.enabled`, `context_view.layout`, and `context_view.auto_probing` configuration settings. `enabled` SHALL default to `false`, `layout` SHALL accept `inline` or `overlay` and default to `inline`, `auto_probing` SHALL be a boolean defaulting to `true`, and the system SHALL avoid Context View capture, probe, command, and event-driven UI activity while the feature is disabled.

#### Scenario: Feature is omitted from configuration
- **WHEN** pi-qol loads configuration without a `context_view` section
- **THEN** Context View is disabled by default
- **AND THEN** its layout defaults to `inline`
- **AND THEN** automatic probing defaults to enabled

#### Scenario: Feature is enabled
- **WHEN** pi-qol loads configuration with `context_view.enabled` set to `true`
- **THEN** Context View lifecycle capture and invocation entry points are activated

#### Scenario: Overlay layout is configured
- **WHEN** pi-qol loads configuration with `context_view.layout` set to `overlay`
- **THEN** Context View uses overlay presentation when opened

#### Scenario: Invalid layout is configured
- **WHEN** `context_view.layout` is neither `inline` nor `overlay`
- **THEN** configuration validation rejects the value

#### Scenario: Automatic probing is disabled
- **WHEN** pi-qol loads configuration with `context_view.auto_probing` set to `false`
- **THEN** Context View never sends a silent initial-capture probe
- **AND THEN** passive capture from real turns continues to operate

#### Scenario: Invalid automatic probing value is configured
- **WHEN** `context_view.auto_probing` is not a boolean
- **THEN** configuration validation rejects the value

### Requirement: Tabbed context inspection
The Context View interface SHALL open using its configured inline or overlay layout, SHALL occupy at most half the TUI height in either layout, SHALL visibly contain Usage and Injections tabs, SHALL default to Usage on every new opening, and SHALL cycle tabs with `Tab` and `Shift+Tab` in forward and reverse order respectively, except while a filter or search text input is active. Inline presentation SHALL render in the normal custom-UI flow, while overlay presentation SHALL render in a centered bordered overlay.

#### Scenario: Default inline presentation
- **WHEN** Context View opens without an explicit layout configuration or with layout set to `inline`
- **THEN** it renders inline in the normal custom-UI flow
- **AND THEN** it remains bounded to at most half the TUI height

#### Scenario: Overlay presentation
- **WHEN** Context View opens with layout set to `overlay`
- **THEN** it renders in a centered bordered overlay
- **AND THEN** it remains bounded to at most half the TUI height

#### Scenario: Forward tab cycling
- **WHEN** the user presses `Tab` in either tab or its preview while no text input is active
- **THEN** the other tab becomes active

#### Scenario: Reverse tab cycling
- **WHEN** the user presses `Shift+Tab` in either tab or its preview while no text input is active
- **THEN** the other tab becomes active

#### Scenario: Tab key during text input
- **WHEN** the user presses `Tab` or `Shift+Tab` while a filter or search text input is active
- **THEN** the active tab does not change
- **AND THEN** the key is handled by the active text input

#### Scenario: Tab state is retained
- **WHEN** a user changes tab after navigating, zooming, scrolling, filtering, searching, changing the percentage basis, or opening a preview and later returns to that tab
- **THEN** that tab restores the state it held before the switch

### Requirement: Vim-friendly view navigation
Each tab and preview SHALL support `j` and `k` plus Down and Up for single-step movement, `Ctrl+d` and `Ctrl+u` for page movement, `gg` and `G` for movement to the start and end, Enter to open an available preview or truncated block content, and Esc or `q` to return or close as appropriate. While a filter or search text input is active, printable keys SHALL edit the query instead of navigating. In a chronological Usage preview, single-step movement SHALL navigate by captured-entry block except while revealing an excerpt taller than the viewport. PageUp, PageDown, Home, and End SHALL NOT provide the replaced page or boundary navigation behavior.

#### Scenario: Single-step navigation
- **WHEN** the user presses `j`, `k`, Down, or Up in a navigable list or text preview
- **THEN** the active selection or scroll position moves one step in the corresponding direction within valid bounds

#### Scenario: Block-step navigation
- **WHEN** the user presses a forward or backward single-step key in a chronological Usage block stream
- **THEN** the next or previous captured-entry block becomes selected
- **AND THEN** the view minimally scrolls to reveal the selected block

#### Scenario: Oversized block excerpt is navigated
- **WHEN** the selected block excerpt is taller than the visible preview viewport
- **THEN** single-step movement first reveals the excerpt in the requested direction
- **AND THEN** selection crosses to an adjacent block only after reaching the oversized excerpt's corresponding edge

#### Scenario: Page navigation
- **WHEN** the user presses `Ctrl+d` or `Ctrl+u` in a navigable list or preview
- **THEN** the active selection or scroll position moves one visible page forward or backward

#### Scenario: Boundary navigation
- **WHEN** the user presses `gg` or `G` in a navigable list or preview
- **THEN** the active selection or scroll position moves to the first or last valid position respectively

#### Scenario: Preview and close navigation
- **WHEN** the user presses Enter on previewable content
- **THEN** the corresponding preview opens
- **AND WHEN** the user presses Enter on a selected chronological block with truncated content
- **THEN** a nested preview opens with the block's complete content
- **AND WHEN** the user presses Esc or `q` in the complete-content preview
- **THEN** the active tab returns to the chronological block stream with the same block selected
- **AND WHEN** the user presses Esc or `q` in the block stream or another first-level preview
- **THEN** the active tab returns to its parent view
- **AND WHEN** the user presses Esc or `q` in a parent tab view
- **THEN** Context View closes

#### Scenario: Navigation keys during text input
- **WHEN** a filter or search text input is active and the user types `j`, `k`, `g`, `G`, `q`, `y`, `p`, `n`, or `N`
- **THEN** the character is inserted into the query
- **AND THEN** no navigation, copy, toggle, or close action occurs

#### Scenario: Replaced navigation keys
- **WHEN** the user presses PageUp, PageDown, Home, or End
- **THEN** Context View does not use those keys for page or boundary navigation

### Requirement: Passive capture with degraded fallback
The system SHALL passively freeze the first eligible provider-context snapshot for Injections, SHALL attempt at most one silent initial-capture probe when a view is opened before such a snapshot exists and the silent-probe start conditions are satisfied, SHALL remove synthetic probe messages from later context and usage calculations, SHALL normalize both legacy and Pi 0.84 stream-setup probe abort results so the probe remains absent from the visible transcript, and SHALL fall back to Pi-native prompt and tool information with a visible degraded explanation if complete capture is unavailable.

#### Scenario: First real turn supplies capture data
- **WHEN** the first eligible real model turn reaches provider-context construction
- **THEN** the system freezes that initial snapshot without sending a probe

#### Scenario: View opens before a real turn
- **WHEN** Context View opens before an initial snapshot exists and every silent-probe start condition is satisfied
- **THEN** the system attempts one silent probe to obtain the snapshot
- **AND THEN** synthetic probe messages do not remain part of later context or Usage calculations

#### Scenario: View opens during compaction
- **WHEN** Context View opens before an initial snapshot exists while session compaction is active
- **THEN** the system does not start or consume its one silent-probe attempt
- **AND THEN** Context View uses its degraded Pi-native fallback with a visible compaction explanation
- **AND THEN** a later opening may attempt the silent probe after compaction ends

#### Scenario: Probe abort uses Pi 0.84 error reporting
- **WHEN** the synthetic probe assistant ends with an error stop reason and the Pi stream-setup abort message
- **THEN** the system treats it as the expected probe abort
- **AND THEN** the transcript does not display an error or aborted-operation row for that synthetic assistant

#### Scenario: Complete capture is unavailable
- **WHEN** passive capture has not occurred and the silent probe cannot start, times out, or fails
- **THEN** Context View remains usable with Pi-native prompt and tool data
- **AND THEN** the interface identifies that extension additions were not fully observed

## ADDED Requirements

### Requirement: Silent probe start conditions
The system SHALL start the silent probe only when automatic probing is enabled, the session is idle, no compaction is active, no user input is queued, a model with configured authentication is selected, that model is not a Pi virtual model, idle cache warming is not enabled, current usage is below Pi's auto-compaction threshold, and the settings needed for these checks are readable. A failed condition SHALL NOT consume the probe attempt.

#### Scenario: Input is queued
- **WHEN** Context View opens before an initial snapshot exists while steering or follow-up input is queued
- **THEN** no silent probe is sent
- **AND THEN** the degraded fallback explains that queued input prevented probing

#### Scenario: Virtual model is selected
- **WHEN** the selected model is a Pi virtual model
- **THEN** no silent probe is sent and the degraded fallback names the reason

#### Scenario: Idle cache warming is enabled
- **WHEN** Pi's cache-warming mode is `idle`
- **THEN** no silent probe is sent and the degraded fallback names the reason

#### Scenario: Usage is at the auto-compaction threshold
- **WHEN** auto-compaction is enabled and current context usage meets Pi's compaction threshold for the selected model
- **THEN** no silent probe is sent and the degraded fallback names the reason

#### Scenario: Settings cannot be read
- **WHEN** reading the settings required for the start conditions fails
- **THEN** no silent probe is sent and the degraded fallback names the reason

#### Scenario: Automatic probing is disabled
- **WHEN** `context_view.auto_probing` is `false`
- **THEN** no silent probe is sent and the degraded fallback states that probing is disabled by configuration

#### Scenario: Condition later clears
- **WHEN** a start condition failed on one opening and is satisfied on a later opening in the same runtime
- **THEN** the later opening may attempt the silent probe

### Requirement: Silent probe isolation from other extensions
The silent probe SHALL claim only the idle, non-queued user-message input and run it sent itself, SHALL abort only that claimed run, and SHALL blank or filter only its own empty prompt and expected setup-abort result. Messages, custom-message runs, and queued input from other sources SHALL keep their content and SHALL NOT be aborted by Context View.

#### Scenario: Another extension starts a custom-message run during the probe
- **WHEN** a run that is not the probe's own user-message run starts while the probe is pending
- **THEN** that run is not aborted
- **AND THEN** the probe attempt fails with a degraded explanation instead of capturing that run

#### Scenario: A message shares the probe prompt timestamp
- **WHEN** another message with the same role and timestamp as the probe prompt but non-empty content appears in context
- **THEN** that message is neither blanked nor removed from context or Usage calculations

#### Scenario: Persisted identities are restored
- **WHEN** a session with persisted probe identities is resumed and contains a non-empty message matching a persisted identity
- **THEN** that message remains in context and Usage calculations

#### Scenario: A nested send is detected
- **WHEN** a second user-message input attributable to the probe's send scope arrives during the probe
- **THEN** neither run is aborted
- **AND THEN** the probe attempt fails with an explanation that the empty probe prompt may have reached the model

### Requirement: Capture limited to presentable sessions
The system SHALL perform Context View capture and silent probing only in sessions where Context View can be presented, and SHALL perform no capture work for runs in non-interactive modes.

#### Scenario: Non-interactive run
- **WHEN** Pi runs in print or JSON mode with Context View enabled
- **THEN** Context View captures no provider context and sends no silent probe

#### Scenario: Interactive TUI run
- **WHEN** Pi runs in TUI mode with Context View enabled
- **THEN** passive capture operates as specified

### Requirement: System-role message capture
The initial capture SHALL include system-role messages present in the final provider context after all extension context handlers have run, and SHALL measure, attribute, and preview them as observable extension additions without modifying the provider context.

#### Scenario: An extension adds a system-role message
- **WHEN** the first eligible turn's final provider context contains a system-role message beyond Pi's leading system prompt
- **THEN** Injections lists that message with a token estimate and previewable text
- **AND THEN** Usage includes its tokens in the estimated composition

#### Scenario: Capture observes the final context
- **WHEN** Context View captures the final provider context
- **THEN** the provider context sent to the model is unchanged by that capture

### Requirement: Extension source attribution
Injections SHALL group tools loaded from distinct local, automatically discovered, or command-line extension paths under separate sources labelled by the shortest path suffix that is unique among those extensions, omitting a trailing index file name. Package-installed extensions SHALL keep their package source label.

#### Scenario: Two path-loaded extensions provide tools
- **WHEN** two extensions with the same source kind but different paths each register an active tool
- **THEN** Injections shows each extension as a separate source group with a distinguishing label

#### Scenario: Package extension provides tools
- **WHEN** an extension installed from a package registers an active tool
- **THEN** Injections groups its tools under the package source label

### Requirement: Hidden tool exclusion
The system SHALL NOT count tools that Pi hides from the model as available tool definitions in Usage or Injections token totals.

#### Scenario: A hidden tool is registered
- **WHEN** a registered tool is hidden from the model by Pi
- **THEN** its definition contributes no tokens to Usage or Injections tool totals
- **AND THEN** Injections does not present it as an active tool definition

### Requirement: Mouse wheel scrolling
Context View lists and previews SHALL scroll in response to the host's normalized mouse-wheel events by the host-supplied scroll amount whenever the host delivers wheel input to the view, and SHALL consume handled wheel events so they do not also scroll the transcript.

#### Scenario: Wheel over an open view
- **WHEN** the host delivers a wheel-down event to an open Context View list or preview
- **THEN** the active selection or scroll position moves forward by the delivered amount within valid bounds

#### Scenario: Host keeps wheel input
- **WHEN** the host does not deliver wheel events to extension views, such as in non-fullscreen terminal mode
- **THEN** keyboard navigation remains fully available

### Requirement: Stable Injections list height
The Injections list SHALL keep a constant rendered height for a given available height regardless of the selected row, the number of visible rows, an active filter prompt, or a transient notice.

#### Scenario: Selection moves
- **WHEN** the user moves the selection between rows of different kinds
- **THEN** the overall Injections rendering height does not change

#### Scenario: Filter reduces visible rows
- **WHEN** a filter leaves fewer rows than fit in the list
- **THEN** the list area is padded to its previous height

### Requirement: Injections filtering
The Injections tab SHALL open a filter prompt on `/` that matches case-insensitive literal substrings in either Name mode (contribution and group labels) or Content mode (contribution text), SHALL toggle mode with `Tab` or `Shift+Tab` while the prompt is active, and SHALL keep the ancestors of matches visible as context.

#### Scenario: Name filter
- **WHEN** the user presses `/` in the Injections list and types a query in Name mode
- **THEN** only groups and contributions whose labels contain the query, their descendants, and their ancestors remain visible

#### Scenario: Content filter
- **WHEN** the user toggles to Content mode and types a query
- **THEN** only contributions whose text contains the query, ignoring whitespace differences, and their ancestors remain visible

#### Scenario: Filter is confirmed
- **WHEN** the user presses Enter in the filter prompt
- **THEN** the prompt closes, the filter stays applied, and list navigation resumes on the filtered rows

#### Scenario: Filter is cleared
- **WHEN** the user presses Esc in the filter prompt
- **THEN** the filter is cleared and the full list is restored

#### Scenario: No contributions match
- **WHEN** the active filter matches nothing
- **THEN** the list indicates that no contributions match without failing the view

### Requirement: Preview search
Text previews of contributions and complete entry content SHALL open a search prompt on `/` that finds case-insensitive literal matches, highlights them, scrolls to the first match at or after the current position, and SHALL move to the next or previous match with wrap-around on `n` and `N` after the search is confirmed.

#### Scenario: Search finds matches
- **WHEN** the user presses `/` in a text preview and types a query that occurs in the content
- **THEN** matches are highlighted, the current match is distinguished, and the view scrolls to reveal it
- **AND THEN** the prompt shows the current match position and total match count

#### Scenario: Match navigation wraps
- **WHEN** a confirmed search is active on the last match and the user presses `n`
- **THEN** the first match becomes current and is revealed
- **AND WHEN** the first match is current and the user presses `N`
- **THEN** the last match becomes current and is revealed

#### Scenario: Search is cancelled
- **WHEN** the user presses Esc in the search prompt
- **THEN** the search and its highlights are cleared and normal preview navigation resumes

#### Scenario: No match exists
- **WHEN** the query occurs nowhere in the content
- **THEN** the prompt reports no matches and the scroll position does not change

### Requirement: Clipboard copy
Context View SHALL copy the selected content to the system clipboard on `y`. In list views, that is the selected Injections contribution, the visible contributions of a selected group, or a selected Usage category's content. In previews, it is the complete previewed content or the selected block. The view SHALL show a transient notice reporting success, emptiness, or failure.

#### Scenario: Contribution is copied
- **WHEN** the user presses `y` on an Injections contribution
- **THEN** its complete captured text is copied
- **AND THEN** a notice reports the number of characters copied

#### Scenario: Group is copied under a filter
- **WHEN** the user presses `y` on an Injections group while a filter is applied
- **THEN** only the text of that group's contributions visible under the filter is copied

#### Scenario: Nothing to copy
- **WHEN** the selected row has no copyable text
- **THEN** the clipboard is not changed and a notice reports that nothing was copied

#### Scenario: Clipboard is unavailable
- **WHEN** the clipboard write fails
- **THEN** Context View remains open and a notice reports the copy failure reason

### Requirement: Usage percentage basis toggle
The Usage tab SHALL toggle category percentages on `p` between share of the context window and share of the estimated used total. The window basis SHALL be the default on each opening, the active basis SHALL be labelled, and the header's overall usage figure SHALL always be relative to the context window.

#### Scenario: Default window basis
- **WHEN** Usage opens with a known context window
- **THEN** each category percentage is its estimated tokens divided by the context window

#### Scenario: Used basis
- **WHEN** the user presses `p` in Usage
- **THEN** each category percentage is its estimated tokens divided by the sum of estimated category tokens
- **AND THEN** buffer and free-space rows show no percentage
- **AND THEN** the percentage label identifies the used basis

#### Scenario: Denominator unavailable
- **WHEN** the selected basis has no positive denominator
- **THEN** category percentages are left blank without failing the view
