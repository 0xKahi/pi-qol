## MODIFIED Requirements

### Requirement: Usage provider tabs
The `Usage` section SHALL show one tab for each supported subscription provider, labelled `[Claude]`, `[Codex]`, and `[OC-GO]` in that order, in the same bracketed tab style as the Select Model tabs. When the Usage section first becomes active in an opening, the tab for the current model's provider SHALL be active if that provider is supported; otherwise the first tab SHALL be active. `Tab` and `Shift+Tab` SHALL cycle provider tabs.

#### Scenario: Current provider preselected
- **WHEN** the current model's provider is OpenAI Codex and the user first switches to `Usage`
- **THEN** the `Codex` tab is active

#### Scenario: OpenCode Go preselected
- **WHEN** the current model's provider is `opencode-go` and the user first switches to `Usage`
- **THEN** the `OC-GO` tab is active

#### Scenario: Unsupported current provider
- **WHEN** the current model's provider is not a supported subscription provider and the user first switches to `Usage`
- **THEN** the `Claude` tab is active
