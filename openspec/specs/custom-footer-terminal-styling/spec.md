# Custom Footer Terminal Styling

## Purpose

Define how the custom footer applies configured terminal truecolor styling while preserving readable fallback text.

## Requirements

### Requirement: Configured truecolor styling
The custom footer SHALL apply each configured custom-footer hex color to its corresponding text using terminal truecolor when color output is enabled.

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
- **THEN** the response label, window label, filled progress, and percentage use the provider's configured foreground truecolor

### Requirement: Styling fallback behavior
The custom footer SHALL preserve readable plain text and existing Pi theme fallbacks when custom ANSI color output is unavailable or not configured.

#### Scenario: Optional custom color is absent
- **WHEN** the directory or model custom color is not configured
- **THEN** the footer renders that segment with the existing dim theme styling

#### Scenario: Terminal color output is disabled
- **WHEN** terminal color output is disabled by the styling library's environment or explicit setting
- **THEN** custom-colored segments render as unchanged primitive plain strings
- **AND** footer content, width calculation, and truncation remain functional

### Requirement: ANSI-compatible visible text
The custom footer SHALL produce text whose visible content can be recovered by general ANSI CSI stripping without altering non-ANSI characters.

#### Scenario: Styled subscription segment is stripped
- **WHEN** ANSI sequences are stripped from a styled subscription usage segment
- **THEN** the result contains the same provider labels, progress characters, percentage, and reset description as the unstyled segment
