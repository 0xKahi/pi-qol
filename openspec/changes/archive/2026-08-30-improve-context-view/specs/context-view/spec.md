## ADDED Requirements

### Requirement: Accurate and sectioned tool contribution measurement
The system SHALL count each rendered tool prompt contribution at most once, SHALL preserve Pi-native ownership when a built-in and extension tool declare the same rendered guideline, and SHALL expose labeled prompt-snippet, guideline, and definition sections with token estimates that sum to the measured tool total when those sections are present.

#### Scenario: Several tools share one guideline
- **WHEN** multiple active tools declare guideline text that Pi renders once in the system prompt
- **THEN** Context View attributes that rendered text to at most one tool in active-tool order
- **AND THEN** the shared text contributes tokens to the context total only once

#### Scenario: Extension tool repeats a Pi-owned guideline
- **WHEN** an extension tool declares a guideline already rendered for Pi or a built-in tool
- **THEN** Context View does not attribute the Pi-owned rendered line to the extension tool

#### Scenario: Sectioned tool content is previewed
- **WHEN** a measured tool contribution contains a prompt snippet, guideline text, or definition
- **THEN** its available sections are labeled in Usage and Injections previews
- **AND THEN** the section token estimates sum exactly to the tool contribution's token estimate

## MODIFIED Requirements

### Requirement: Vim-friendly view navigation
Each tab and preview SHALL support `j` and `k` plus Down and Up for single-step movement, `Ctrl+d` and `Ctrl+u` for page movement, `gg` and `G` for movement to the start and end, Enter to open an available preview or truncated block content, and Esc or `q` to return or close as appropriate. In a chronological Usage preview, single-step movement SHALL navigate by captured-entry block except while revealing an excerpt taller than the viewport. PageUp, PageDown, Home, and End SHALL NOT provide the replaced page or boundary navigation behavior.

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

#### Scenario: Replaced navigation keys
- **WHEN** the user presses PageUp, PageDown, Home, or End
- **THEN** Context View does not use those keys for page or boundary navigation

### Requirement: Context usage presentation
The Usage tab SHALL present an estimated next-request context composition grouped into meaningful categories, available provider-reported context usage, Pi's effective auto-compaction reserve when enabled and readable, a proportional occupied/buffer/free-space map when sufficient data and width exist, the token size and map share represented by a cell, selectable category details, block-aware chronological content previews, expandable complete content for truncated blocks, and the existing Usage zoom behavior.

#### Scenario: Usage data is available
- **WHEN** Context View opens with context-window and session data available
- **THEN** Usage displays estimated category totals alongside available reported token and context-window information
- **AND THEN** previewable categories can be inspected without modifying the session context

#### Scenario: Auto-compaction reserve is available
- **WHEN** auto-compaction is enabled and its effective reserve can be read
- **THEN** Usage includes the remaining reserve as an Auto-Compact Buffer in its textual details and proportional map
- **AND THEN** occupied context reduces the visible buffer rather than extending the map beyond the context window

#### Scenario: Auto-compaction settings are unavailable
- **WHEN** auto-compaction is disabled or its effective settings cannot be read
- **THEN** Usage remains available without an Auto-Compact Buffer

#### Scenario: Context map is rendered
- **WHEN** sufficient context-window data and terminal width allow the proportional map to render
- **THEN** Usage identifies the approximate token size and proportional share represented by each map cell for the active map scale

#### Scenario: Context map cannot be rendered
- **WHEN** context-window data is unavailable or the terminal is too narrow for the map
- **THEN** Usage continues to display its textual category details without failing the view

#### Scenario: Category content contains several entries
- **WHEN** the user previews a category with captured content
- **THEN** Usage presents the entries chronologically as separately selectable blocks
- **AND THEN** each block identifies its entry and displays a height-bounded excerpt

#### Scenario: A block excerpt omits content
- **WHEN** an entry's content exceeds its block excerpt limit
- **THEN** the block indicates that content is hidden
- **AND THEN** Enter opens a nested scrollable preview containing the complete entry content

#### Scenario: A block excerpt is complete
- **WHEN** the selected block contains no hidden content
- **THEN** Enter does not create a redundant complete-content preview

### Requirement: Context injection presentation
The Injections tab SHALL present the captured initial context contributions as a source-grouped hierarchy with token estimates and SHALL allow previewing captured contribution text, including Pi prompt components, active tool definitions, skills, context files, and observable extension additions. When a tool contribution has measured sections, its preview SHALL label those sections and their token estimates.

#### Scenario: Initial capture is available
- **WHEN** an initial context snapshot has been captured
- **THEN** Injections displays its grouped hierarchy and allows previewing selectable contribution content

#### Scenario: Tool section details are available
- **WHEN** a previewed tool contribution contains measured prompt, guideline, or definition sections
- **THEN** Injections displays each available section under a distinct label with its token estimate

#### Scenario: Some extension attribution is unknowable
- **WHEN** a contribution is observable but cannot be attributed to one extension
- **THEN** Injections presents it as an aggregate extension contribution rather than claiming an incorrect source

### Requirement: Passive capture with degraded fallback
The system SHALL passively freeze the first eligible provider-context snapshot for Injections, SHALL attempt at most one silent initial-capture probe when a view is opened before such a snapshot exists and compaction is not active, SHALL remove synthetic probe messages from later context and usage calculations, SHALL normalize both legacy and Pi 0.84 stream-setup probe abort results so the probe remains absent from the visible transcript, and SHALL fall back to Pi-native prompt and tool information with a visible degraded explanation if complete capture is unavailable.

#### Scenario: First real turn supplies capture data
- **WHEN** the first eligible real model turn reaches provider-context construction
- **THEN** the system freezes that initial snapshot without sending a probe

#### Scenario: View opens before a real turn
- **WHEN** Context View opens before an initial snapshot exists, compaction is not active, and a model with configured authentication is available
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
