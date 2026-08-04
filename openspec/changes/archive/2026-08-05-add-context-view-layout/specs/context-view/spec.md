## MODIFIED Requirements

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
