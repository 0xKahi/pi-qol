## ADDED Requirements

### Requirement: Coordinated modal presentation
The modal library SHALL provide a shared presentation abstraction accepting an `inline` or `overlay` layout and SHALL coordinate the dialog frame with the host custom-UI mounting options. Inline layout SHALL use an inline frame without overlay mounting. Overlay layout SHALL use a bordered frame and centered overlay mounting with shared defaults. Consumers SHALL be able to retain independent dialog height policies in either layout.

#### Scenario: Present inline modal
- **WHEN** a consumer opens a modal with layout set to `inline`
- **THEN** the modal uses the inline frame
- **AND THEN** the host mounts it in the normal custom-UI flow without overlay options

#### Scenario: Present overlay modal
- **WHEN** a consumer opens a modal with layout set to `overlay`
- **THEN** the modal uses the bordered frame
- **AND THEN** the host mounts it as a centered overlay using the shared width and margin defaults

#### Scenario: Preserve independent height policy
- **WHEN** a height-bounded modal is opened using either supported layout
- **THEN** its configured height bound remains in effect

#### Scenario: Existing Model Select presentation is preserved
- **WHEN** Model Select opens using either its inline or overlay layout
- **THEN** its frame and host mounting behavior remain equivalent to the behavior before adoption of the shared presentation abstraction
