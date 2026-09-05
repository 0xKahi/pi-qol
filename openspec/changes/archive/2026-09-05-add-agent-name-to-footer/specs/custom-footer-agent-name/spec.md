## Purpose

Define the configurable agent-identity badge shown in the custom footer and the event contract other extensions use to update that identity safely at runtime.

## ADDED Requirements

### Requirement: Agent-name configuration
The custom footer SHALL support `display.agentName`, `defaultAgentName`, and `colors.agentName` configuration. `display.agentName` SHALL default to `false`, `defaultAgentName` SHALL default to `"DEFAULT"`, and `colors.agentName` SHALL be optional and accept only `#RRGGBB` hex colors. A configured default name MUST contain at least one displayable non-whitespace character after normalization.

#### Scenario: Agent-name configuration is omitted
- **WHEN** custom-footer configuration omits all agent-name fields
- **THEN** agent-name display is disabled
- **AND** the configured default agent name is `"DEFAULT"`
- **AND** no custom agent-name color is set

#### Scenario: Agent-name configuration is valid
- **WHEN** a user enables `display.agentName`, supplies a non-empty `defaultAgentName`, and supplies a valid `colors.agentName`
- **THEN** the custom footer accepts those values

#### Scenario: Configured default name is empty
- **WHEN** `defaultAgentName` is empty or contains no displayable non-whitespace characters after normalization
- **THEN** configuration validation fails

#### Scenario: Configured agent-name color is invalid
- **WHEN** `colors.agentName` is not a valid six-digit hex color
- **THEN** configuration validation fails

### Requirement: First-line agent badge
When `display.agentName` is enabled, the custom footer SHALL render the normalized agent name in bold and inverse styling at the beginning of the first line, with one styled padding space on each side and without literal brackets. One normal, unstyled separator space SHALL appear between the badge's trailing padding and the existing directory segment. When the display option is disabled, the existing first-line content SHALL remain unchanged.

#### Scenario: Agent-name display is enabled
- **WHEN** `display.agentName` is `true`
- **THEN** the first footer line begins with the bold, inverse-styled current agent name
- **AND** the badge contains no added square brackets
- **AND** one bold, inverse-styled space appears before and after the name
- **AND** one normal, unstyled space separates the trailing badge padding from the directory icon and basename

#### Scenario: Agent-name display is disabled
- **WHEN** `display.agentName` is `false`
- **THEN** no agent-name badge or separator is rendered
- **AND** the directory remains the first visible segment

### Requirement: Agent-name normalization and width limit
The custom footer SHALL trim leading and trailing whitespace, remove ANSI escape sequences and unsafe control characters, and limit the displayed agent name to ten terminal-visible columns. A name wider than ten visible columns SHALL display its first ten visible columns followed by `...`. The badge's two padding spaces SHALL not count toward the agent-name width limit.

#### Scenario: Name has surrounding whitespace
- **WHEN** the current name is `"  Build Agent  "`
- **THEN** normalization removes the surrounding whitespace before width limiting

#### Scenario: Name exceeds the display limit
- **WHEN** the current name is `"VERY-LONG-AGENT-NAME"`
- **THEN** the badge's visible text is `"VERY-LONG-..."`

#### Scenario: Name contains wide Unicode characters
- **WHEN** the current name contains characters whose terminal width exceeds one column
- **THEN** truncation is based on terminal-visible columns rather than JavaScript code-unit count
- **AND** the rendered line does not split a display character

#### Scenario: Name contains terminal control content
- **WHEN** the current name contains ANSI escape sequences or unsafe control characters
- **THEN** those sequences and characters do not reach the rendered footer

### Requirement: Agent badge color fallback
The custom footer SHALL use the current valid event color for the agent badge when present, otherwise the configured `colors.agentName`, otherwise Pi's `accent` foreground theme color. In all cases the selected foreground styling SHALL be combined with inverse styling.

#### Scenario: Event supplies a valid color
- **WHEN** a valid name update event supplies a valid `#RRGGBB` color
- **THEN** the badge uses that event color as its foreground before inversion

#### Scenario: Event color is absent or invalid
- **WHEN** a valid name update event omits `color` or supplies an invalid color
- **THEN** the badge uses the configured `colors.agentName` if present
- **AND** it does not retain a color from an earlier event

#### Scenario: No custom color is available
- **WHEN** neither the current event nor configuration provides a valid agent-name color
- **THEN** the badge uses Pi's `accent` foreground theme color before inversion

### Requirement: Cross-extension agent-name updates
The extension SHALL listen on `pi.qol.event:set-agent-name` for payloads containing `agentName` and optional `color`. A valid update SHALL replace the current agent name, resolve its color using the defined fallback order, and request a footer render. A payload with a missing, non-string, or empty normalized name SHALL be ignored in full.

#### Scenario: Another extension sends a valid update
- **WHEN** another extension emits `pi.qol.event:set-agent-name` with `{ agentName: "NewAgentName", color: "#FFFFFF" }`
- **THEN** the current agent name becomes `"NewAgentName"`
- **AND** the current event color becomes `"#FFFFFF"`
- **AND** the footer is requested to render the update

#### Scenario: Valid name has no valid event color
- **WHEN** another extension emits a valid non-empty `agentName` with no valid `color`
- **THEN** the current agent name is updated
- **AND** its color falls back to configured `colors.agentName` and then Pi's accent theme

#### Scenario: Event name is invalid
- **WHEN** an event payload has no `agentName`, has a non-string `agentName`, or its normalized `agentName` is empty
- **THEN** the event is ignored
- **AND** neither the current name nor current color changes

### Requirement: Session-scoped agent identity
The custom footer SHALL reset the current agent name to `defaultAgentName` and discard event-specific color state on every session start. The reset badge color SHALL use configured `colors.agentName` or Pi's accent theme fallback.

#### Scenario: A new session starts after an event update
- **WHEN** the current name and color were changed by an event and a session starts
- **THEN** the current name resets to the configured `defaultAgentName`
- **AND** the previous event color is discarded
- **AND** the badge color resolves from configuration and then Pi's accent theme
