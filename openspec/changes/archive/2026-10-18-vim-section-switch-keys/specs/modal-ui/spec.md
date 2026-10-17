## MODIFIED Requirements

### Requirement: Section switching keys
The sectioned modal SHALL switch to the next section on `Ctrl+L` and to the previous section on `Ctrl+H`, wrapping in both directions, before any other input routing. A raw `0x08` byte SHALL always be passed to the active section, never treated as a section switch, because terminals may send it for Backspace. `Ctrl+H` SHALL switch sections only when the terminal reports it as a separate key sequence. `Ctrl+]` and `Ctrl+[` SHALL NOT switch sections. A bare `\x1b` byte SHALL be passed to the active section as Esc. `Tab` and `Shift+Tab` SHALL continue to cycle tabs inside the active section. Switching sections SHALL reset any pending navigation chord in the section being left. With a single section, the section switching keys SHALL do nothing. With two or more sections, each section SHALL show the hint `^L/^H Section`.

#### Scenario: Next section with wrap
- **WHEN** the last section is active and the user presses `Ctrl+L`
- **THEN** the first section becomes active

#### Scenario: Previous section with a disambiguated key
- **WHEN** the terminal reports `Ctrl+H` as a separate key sequence and the user presses it on the first section
- **THEN** the last section becomes active

#### Scenario: Raw backspace byte is never a section switch
- **WHEN** the modal receives a raw `0x08` byte while a section's filter input has text
- **THEN** the active section handles it as Backspace and the active section does not change

#### Scenario: Former keys no longer switch
- **WHEN** the user presses `Ctrl+]`, or `Ctrl+[` reported as a separate key sequence
- **THEN** the active section does not change

#### Scenario: Bare Esc is never a section switch
- **WHEN** the modal receives a bare `\x1b` byte
- **THEN** the active section handles it as Esc and the active section does not change

#### Scenario: Tab stays inside the section
- **WHEN** the user presses `Tab` or `Shift+Tab`
- **THEN** the active section's tabs cycle and the active section does not change

#### Scenario: Pending chord does not leak across sections
- **WHEN** the user presses `g` in a Vim-navigated section and then switches section and back
- **THEN** no pending `gg` chord remains in effect

#### Scenario: Section hint
- **WHEN** a sectioned modal has two or more sections
- **THEN** the hints show `^L/^H Section`
