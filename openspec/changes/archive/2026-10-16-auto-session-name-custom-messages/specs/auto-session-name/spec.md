# Spec Delta

## Purpose

Automatically gives a new Pi session a short, human-readable title derived from its first eligible message, without blocking the agent turn, and lets extensions opt their custom messages into triggering it.

## ADDED Requirements

### Requirement: Feature toggle
Auto session naming SHALL run only when `auto_session_name.enabled` is `true`. The feature SHALL default to disabled.

#### Scenario: Feature disabled
- **WHEN** `auto_session_name.enabled` is omitted or `false` and an agent run starts
- **THEN** no title is generated and the session name is unchanged

### Requirement: Custom message whitelist configuration
The system SHALL accept `auto_session_name.custom_message_whitelist` as a list of custom message `customType` strings, defaulting to an empty list. A partial config layer that omits the key SHALL NOT override a value set in another layer.

#### Scenario: Whitelist omitted
- **WHEN** no config layer sets `custom_message_whitelist`
- **THEN** the effective whitelist is empty and only user prompts can trigger naming

#### Scenario: Project layer omits whitelist
- **WHEN** the global config sets `custom_message_whitelist` and the project config sets other `auto_session_name` keys but not the whitelist
- **THEN** the effective whitelist is the global value

### Requirement: Naming text from user prompts
For a run started by a user prompt, the system SHALL use the trimmed prompt text as the naming input, and SHALL NOT trigger naming when the trimmed prompt is empty.

#### Scenario: Non-empty user prompt
- **WHEN** a run starts with the user prompt `"  Fix the bug  "`
- **THEN** the naming input is `"Fix the bug"`

#### Scenario: Whitespace-only user prompt
- **WHEN** a run starts with a prompt containing only whitespace
- **THEN** no title is generated for that run

### Requirement: Naming text from whitelisted custom messages
For a run started by a custom message, the system SHALL trigger naming only when its `customType` is in the whitelist, using its text content (text blocks joined, images ignored, trimmed). Empty resulting text SHALL NOT trigger naming.

#### Scenario: Whitelisted custom message with text
- **WHEN** a run starts with a custom message whose `customType` is whitelisted and whose content has text blocks `" Review "` and `"changes "` plus an image
- **THEN** the naming input is `"Review changes"`

#### Scenario: Non-whitelisted custom message
- **WHEN** a run starts with a custom message whose `customType` is not whitelisted
- **THEN** no title is generated and no other naming guards are evaluated

#### Scenario: Whitelisted image-only custom message
- **WHEN** a run starts with a whitelisted custom message containing only images or whitespace
- **THEN** no title is generated for that run

### Requirement: Session eligibility
The system SHALL NOT generate a title when the session already has a name, or when the session is a fork or child session.

#### Scenario: Session already named
- **WHEN** an eligible run starts in a session that already has a name
- **THEN** the existing name is kept and no title is generated

#### Scenario: Forked session
- **WHEN** an eligible run starts in a session started by fork or whose header has a parent session
- **THEN** no title is generated

### Requirement: First naming turn only
Naming SHALL occur only if the session branch contains no earlier user message or whitelisted custom message with non-whitespace text. Earlier blank, whitespace-only, or image-only messages, and non-whitelisted custom messages, SHALL NOT block naming.

#### Scenario: Earlier user message with text
- **WHEN** the branch already contains a user message with text and a new eligible run starts
- **THEN** no title is generated

#### Scenario: Earlier image-only user message
- **WHEN** the branch's only earlier user message contains just an image and the user then sends a text prompt
- **THEN** a title is generated from the text prompt

#### Scenario: Earlier whitelisted custom message with text
- **WHEN** the branch already contains a whitelisted custom message with text and a new eligible run starts
- **THEN** no title is generated

#### Scenario: Earlier non-whitelisted custom message
- **WHEN** the branch contains only a non-whitelisted custom message and an eligible run starts
- **THEN** a title is generated

### Requirement: Non-blocking title generation
Title generation SHALL run in the background without delaying the agent turn, and SHALL apply the generated title as the session name. A newer naming request SHALL cancel any in-flight one.

#### Scenario: Eligible run
- **WHEN** all naming guards pass
- **THEN** the agent turn proceeds immediately and the session name is set when the title is ready
