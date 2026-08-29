# model-select-default-reasoning Specification

## Purpose

Lets users configure a global default reasoning level that is applied automatically whenever a model is selected through the model selector, without overriding pi's own behavior for models that don't support the configured level.

## Requirements

### Requirement: Default reasoning configuration
The system SHALL accept an optional `model_select.default_reasoning` value using the existing reasoning-level enum (`off`, `minimal`, `low`, `medium`, `high`, `xhigh`) that has no default value.

#### Scenario: Default reasoning is omitted
- **WHEN** the user does not configure `model_select.default_reasoning`
- **THEN** the parsed configuration has no default reasoning value and model selection does not attempt to change the thinking level beyond pi's own behavior

#### Scenario: Default reasoning is configured
- **WHEN** the user configures `model_select.default_reasoning` to a valid reasoning level
- **THEN** the parsed configuration retains that value

### Requirement: Apply default reasoning after model selection
When a model is applied as a result of using the model selector (either through the interactive picker or an exact `provider/modelId` match) and `model_select.default_reasoning` is configured, the system SHALL set the session's thinking level to the configured value if and only if the newly selected model supports that exact level.

#### Scenario: Selected model supports the configured level
- **WHEN** `model_select.default_reasoning` is configured to a level and the user selects a model that supports that exact level
- **THEN** the session's thinking level is set to the configured level after the model is applied

#### Scenario: Selected model does not support the configured level
- **WHEN** `model_select.default_reasoning` is configured to a level that the selected model does not support
- **THEN** the system does not attempt to change the thinking level, leaving whatever level pi's own model-switch behavior established

#### Scenario: Model has no reasoning support at all
- **WHEN** `model_select.default_reasoning` is configured and the user selects a model that does not support reasoning/thinking at all
- **THEN** the system treats the configured level as unsupported unless it is `off`, and does not attempt to change the thinking level

#### Scenario: Model application fails
- **WHEN** the selected model cannot be applied (for example, no configured auth is available)
- **THEN** the system does not attempt to change the thinking level

#### Scenario: Default reasoning is not configured
- **WHEN** `model_select.default_reasoning` is not configured
- **THEN** selecting a model does not change the thinking level beyond pi's own default model-switch behavior

### Requirement: Silent fallback behavior
The system SHALL NOT notify the user when the configured default reasoning level is not applied because the selected model does not support it.

#### Scenario: Unsupported level is skipped
- **WHEN** the configured default reasoning level is unsupported by the selected model
- **THEN** no warning or notification is shown to the user about the skipped level

### Requirement: Display configured default reasoning in the model selector
When `model_select.default_reasoning` is configured, the model selector dialog SHALL display the configured value. When it is not configured, the dialog SHALL NOT display any default reasoning indicator.

#### Scenario: Default reasoning is configured
- **WHEN** the model selector dialog is opened and `model_select.default_reasoning` is configured
- **THEN** the dialog displays the configured reasoning level

#### Scenario: Default reasoning is not configured
- **WHEN** the model selector dialog is opened and `model_select.default_reasoning` is not configured
- **THEN** the dialog does not display any default reasoning indicator

#### Scenario: Displayed value does not predict per-model applicability
- **WHEN** the model selector dialog displays the configured default reasoning value
- **THEN** the displayed value reflects configuration only and does not change based on which model is currently selected in the dialog
