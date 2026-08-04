# context-view Specification

## Purpose


Provide an optional interactive interface for understanding model-context occupancy and hidden context contributions without adding persistent content to the model context.


## Requirements

### Requirement: Context View feature configuration
The system SHALL expose `context_view.enabled` and `context_view.layout` configuration settings. `enabled` SHALL default to `false`, `layout` SHALL accept `inline` or `overlay` and default to `inline`, and the system SHALL avoid Context View capture, probe, command, and event-driven UI activity while the feature is disabled.

#### Scenario: Feature is omitted from configuration
- **WHEN** pi-qol loads configuration without a `context_view` section
- **THEN** Context View is disabled by default
- **AND THEN** its layout defaults to `inline`

#### Scenario: Feature is enabled
- **WHEN** pi-qol loads configuration with `context_view.enabled` set to `true`
- **THEN** Context View lifecycle capture and invocation entry points are activated

#### Scenario: Overlay layout is configured
- **WHEN** pi-qol loads configuration with `context_view.layout` set to `overlay`
- **THEN** Context View uses overlay presentation when opened

#### Scenario: Invalid layout is configured
- **WHEN** `context_view.layout` is neither `inline` nor `overlay`
- **THEN** configuration validation rejects the value

### Requirement: Unified Context View command
The system SHALL provide an argument-free `/context-view` command that opens the interactive Context View in TUI mode and SHALL reject non-empty command arguments rather than treating them as separate views.

#### Scenario: Command opens Context View
- **WHEN** an enabled user invokes `/context-view` without arguments in TUI mode
- **THEN** the system opens one Context View interface with Usage selected initially

#### Scenario: Command receives arguments
- **WHEN** a user invokes `/context-view` with any non-whitespace argument
- **THEN** the system reports that `/context-view` accepts no arguments and does not open the interface

#### Scenario: Command is invoked outside TUI mode
- **WHEN** a user invokes `/context-view` where fullscreen custom TUI components are unavailable
- **THEN** the system reports that the command requires TUI mode and does not attempt to render the interface

### Requirement: Vim event activation
The system SHALL listen for `pi.vimKeys.event:pi-qol.context_view` and, when enabled with a current session context, SHALL invoke the same Context View opening behavior used by `/context-view`.

#### Scenario: Vim event opens Context View
- **WHEN** the event `pi.vimKeys.event:pi-qol.context_view` is emitted during an enabled interactive session
- **THEN** the system opens Context View with Usage selected initially

#### Scenario: Vim event has no eligible context
- **WHEN** the event is emitted before a session context is available or while Context View is disabled
- **THEN** the system performs no Context View action

### Requirement: Tabbed context inspection
The Context View interface SHALL open using its configured inline or overlay layout, SHALL occupy at most half the TUI height in either layout, SHALL visibly contain Usage and Injections tabs, SHALL default to Usage on every new opening, and SHALL cycle tabs with `Tab` and `Shift+Tab` in forward and reverse order respectively. Inline presentation SHALL render in the normal custom-UI flow, while overlay presentation SHALL render in a centered bordered overlay.

#### Scenario: Default inline presentation
- **WHEN** Context View opens without an explicit layout configuration or with layout set to `inline`
- **THEN** it renders inline in the normal custom-UI flow
- **AND THEN** it remains bounded to at most half the TUI height

#### Scenario: Overlay presentation
- **WHEN** Context View opens with layout set to `overlay`
- **THEN** it renders in a centered bordered overlay
- **AND THEN** it remains bounded to at most half the TUI height

#### Scenario: Forward tab cycling
- **WHEN** the user presses `Tab` in either tab or its preview
- **THEN** the other tab becomes active

#### Scenario: Reverse tab cycling
- **WHEN** the user presses `Shift+Tab` in either tab or its preview
- **THEN** the other tab becomes active

#### Scenario: Tab state is retained
- **WHEN** a user changes tab after navigating, zooming, scrolling, or opening a preview and later returns to that tab
- **THEN** that tab restores the state it held before the switch

### Requirement: Vim-friendly view navigation
Each tab and preview SHALL support `j` and `k` plus Down and Up for single-step movement, `Ctrl+d` and `Ctrl+u` for page movement, `gg` and `G` for movement to the start and end, Enter to open an available preview, and Esc or `q` to return or close as appropriate. PageUp, PageDown, Home, and End SHALL NOT provide the replaced page or boundary navigation behavior.

#### Scenario: Single-step navigation
- **WHEN** the user presses `j`, `k`, Down, or Up in a navigable list or preview
- **THEN** the active selection or scroll position moves one step in the corresponding direction within valid bounds

#### Scenario: Page navigation
- **WHEN** the user presses `Ctrl+d` or `Ctrl+u` in a navigable list or preview
- **THEN** the active selection or scroll position moves one visible page forward or backward

#### Scenario: Boundary navigation
- **WHEN** the user presses `gg` or `G` in a navigable list or preview
- **THEN** the active selection or scroll position moves to the first or last valid position respectively

#### Scenario: Preview and close navigation
- **WHEN** the user presses Enter on previewable content
- **THEN** the corresponding preview opens
- **AND WHEN** the user presses Esc or `q` in a preview
- **THEN** the active tab returns to its parent view
- **AND WHEN** the user presses Esc or `q` in a parent tab view
- **THEN** Context View closes

#### Scenario: Replaced navigation keys
- **WHEN** the user presses PageUp, PageDown, Home, or End
- **THEN** Context View does not use those keys for page or boundary navigation

### Requirement: Context usage presentation
The Usage tab SHALL present an estimated next-request context composition grouped into meaningful categories, available provider-reported context usage, a proportional occupied/buffer/free-space map when sufficient data and width exist, selectable category details, content previews, and the existing Usage zoom behavior.

#### Scenario: Usage data is available
- **WHEN** Context View opens with context-window and session data available
- **THEN** Usage displays estimated category totals alongside available reported token and context-window information
- **AND THEN** previewable categories can be inspected without modifying the session context

#### Scenario: Context map cannot be rendered
- **WHEN** context-window data is unavailable or the terminal is too narrow for the map
- **THEN** Usage continues to display its textual category details without failing the view

### Requirement: Context injection presentation
The Injections tab SHALL present the captured initial context contributions as a source-grouped hierarchy with token estimates and SHALL allow previewing captured contribution text, including Pi prompt components, active tool definitions, skills, context files, and observable extension additions.

#### Scenario: Initial capture is available
- **WHEN** an initial context snapshot has been captured
- **THEN** Injections displays its grouped hierarchy and allows previewing selectable contribution content

#### Scenario: Some extension attribution is unknowable
- **WHEN** a contribution is observable but cannot be attributed to one extension
- **THEN** Injections presents it as an aggregate extension contribution rather than claiming an incorrect source

### Requirement: Passive capture with degraded fallback
The system SHALL passively freeze the first eligible provider-context snapshot for Injections, SHALL attempt at most one silent initial-capture probe when a view is opened before such a snapshot exists, SHALL remove synthetic probe messages from later context and usage calculations, and SHALL fall back to Pi-native prompt and tool information with a visible degraded explanation if complete capture is unavailable.

#### Scenario: First real turn supplies capture data
- **WHEN** the first eligible real model turn reaches provider-context construction
- **THEN** the system freezes that initial snapshot without sending a probe

#### Scenario: View opens before a real turn
- **WHEN** Context View opens before an initial snapshot exists and a model with configured authentication is available
- **THEN** the system attempts one silent probe to obtain the snapshot
- **AND THEN** synthetic probe messages do not remain part of later context or Usage calculations

#### Scenario: Complete capture is unavailable
- **WHEN** passive capture has not occurred and the silent probe cannot start, times out, or fails
- **THEN** Context View remains usable with Pi-native prompt and tool data
- **AND THEN** the interface identifies that extension additions were not fully observed

### Requirement: Context inspection remains context-neutral
The system MUST NOT persist captured prompt or message content for Context View and MUST NOT add Context View instructions or durable messages to the model context. It MAY persist only the minimal role-and-timestamp identities required to filter synthetic probe messages across session reload, resume, or fork operations.

#### Scenario: Captured content is handled
- **WHEN** Context View captures prompt, tool, skill, context-file, or message content
- **THEN** that content remains process-local and is not written to session metadata by Context View

#### Scenario: Probe identities are restored
- **WHEN** a session containing persisted synthetic probe identities is resumed, reloaded, or forked
- **THEN** the system restores only those identities and continues excluding the matching synthetic messages

### Requirement: Upstream attribution
The user documentation SHALL credit Dmitry Makarov as the creator of the original `pi-context-view` plugin, link to the upstream project, and describe pi-qol Context View as a fork with a unified tabbed interface and Vim-friendly keybindings.

#### Scenario: User reads Context View documentation
- **WHEN** a user reads the pi-qol README section for Context View
- **THEN** the upstream creator, project relationship, and principal interaction changes are clearly identified
