# Spec Delta

## MODIFIED Requirements

### Requirement: Configured truecolor styling
The custom footer SHALL apply each configured custom-footer hex color to its corresponding text using terminal truecolor when color output is enabled. The subscription usage segment SHALL use the fixed per-provider usage color (Claude `#D97706`, Codex `#10B981`) instead of a configured color.

#### Scenario: Directory color is configured
- **WHEN** the custom footer renders a directory with a configured directory color and color output is enabled
- **THEN** the directory segment uses that configured foreground truecolor
- **AND** stripping ANSI sequences yields the unchanged directory text

#### Scenario: Model name color is configured
- **WHEN** the custom footer renders a model name with a configured model color and color output is enabled
- **THEN** the model name uses that configured foreground truecolor
- **AND** its visible text remains unchanged

#### Scenario: Subscription usage color is configured
- **WHEN** the custom footer renders supported-provider subscription usage and color output is enabled
- **THEN** the response label, window label, filled progress, and percentage use that provider's fixed usage color
