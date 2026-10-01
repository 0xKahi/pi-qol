# Spec Delta

## Purpose

Organize the model selector modal into sections so users can move between choosing a model and reviewing subscription usage for supported providers without leaving the modal.

## ADDED Requirements

### Requirement: Sectioned model selector
When `/select-model` opens its interactive picker, it SHALL open a sectioned modal containing a `Select Model` section followed by a `Usage` section, using the configured model selector layout. The `Select Model` section SHALL be active on every new opening. The `Select Model` section SHALL keep all existing model selector behavior (tabs, shared filter, provider filter, default reasoning display, warnings, and confirmation). Confirming a model SHALL apply it exactly as before, and dismissing from either section SHALL close the modal without changing the model. An exact `provider/modelId` argument SHALL continue to apply the model without opening the modal.

#### Scenario: Command opens on Select Model
- **WHEN** the user runs `/select-model` without an exact model argument
- **THEN** the sectioned modal opens with `Select Model` active and `Usage` shown as an inactive section

#### Scenario: Initial query still applies
- **WHEN** the user runs `/select-model` with a non-exact query
- **THEN** the `Select Model` section opens with that query applied, as before this change

#### Scenario: Confirming a model after visiting Usage
- **WHEN** the user switches to `Usage`, switches back to `Select Model`, and confirms a model
- **THEN** that model is applied and the modal closes

#### Scenario: Dismiss from Usage
- **WHEN** the user dismisses the modal while `Usage` is active
- **THEN** the modal closes and the current model is unchanged

### Requirement: Event opens the sectioned model selector
The `pi.vimKeys.event:pi-qol.model_select` event SHALL open the same sectioned modal as `/select-model` when model select is enabled and a session context is available.

#### Scenario: Event opens sectioned modal
- **WHEN** another extension emits the model select event while model select is enabled
- **THEN** the sectioned modal opens with `Select Model` active

### Requirement: Usage provider tabs
The `Usage` section SHALL show one tab for each supported subscription provider, labelled `[Claude]` and `[Codex]` in the same bracketed tab style as the Select Model tabs. When the Usage section first becomes active in an opening, the tab for the current model's provider SHALL be active if that provider is supported; otherwise the first tab SHALL be active. `Tab` and `Shift+Tab` SHALL cycle provider tabs.

#### Scenario: Current provider preselected
- **WHEN** the current model's provider is OpenAI Codex and the user first switches to `Usage`
- **THEN** the `Codex` tab is active

#### Scenario: Unsupported current provider
- **WHEN** the current model's provider is not a supported subscription provider and the user first switches to `Usage`
- **THEN** the `Claude` tab is active

### Requirement: Usage window display
For a provider with usage data, the active provider tab SHALL list every rate window in provider order, with one blank line between consecutive window rows. Each row SHALL show the window label, a progress bar, the used percentage, the time until reset when known, and a pace indicator when the pace is known. A header line SHALL show the provider name and how long ago the displayed data was fetched. The provider name, window labels, progress bar fill, and used percentages SHALL use the fixed provider usage color that the custom footer also uses. The empty part of the bar and the reset text SHALL be dim. While the Usage section is visible, the freshness line and reset countdowns SHALL update at least once per second without user input.

#### Scenario: Windows are listed
- **WHEN** Claude usage has a `5h` window 48% used resetting in 2h13m and a `Week` window 81% used resetting in 3d4h
- **THEN** the Claude tab shows two rows with their labels, progress bars, `48%` and `81%`, `2h13m` and `3d4h`, and pace indicators

#### Scenario: Ahead-of-pace window is distinguished
- **WHEN** a window's pace is `ahead` or `limit`
- **THEN** its pace indicator is shown in warning or error styling respectively

#### Scenario: Freshness line
- **WHEN** the displayed data was fetched 42 seconds ago
- **THEN** the header line indicates it was updated 42s ago

#### Scenario: Provider colors match the footer
- **WHEN** color output is enabled
- **THEN** the Claude provider name, window labels, bar fill, and percentages are colored `#D97706`, as in the footer

#### Scenario: Times tick while visible
- **WHEN** the Usage section is visible and 1 second passes without input
- **THEN** the modal re-renders so the freshness line and reset times update

#### Scenario: No ticking elsewhere
- **WHEN** the Select Model section is active or the modal is closed
- **THEN** no timed re-render is requested for the Usage section

#### Scenario: Rows are spaced
- **WHEN** a provider tab shows two or more windows
- **THEN** exactly one blank line separates each pair of consecutive window rows

### Requirement: Usage provider states
The Usage section SHALL show a clear state for each provider tab instead of hiding it:
- a loading state while the first fetch is in progress
- a `refreshing…` status in the header while a later fetch is in progress and data is shown
- `not logged in` for `no-auth`
- an expired-authentication message for `expired`
- a request-failed message including the HTTP status for `http-error`
- a network-error message for `network`
- a no-usage-data message for `unavailable`

When a fetch fails and earlier successful windows exist, the section SHALL keep showing those windows with the failure message and their original fetch time.

#### Scenario: Not logged in
- **WHEN** the user has no credentials for OpenAI Codex and views the `Codex` tab
- **THEN** the tab shows a not-logged-in message and no rate windows

#### Scenario: Failure with earlier data
- **WHEN** a refresh for Claude fails with a network error after an earlier successful fetch
- **THEN** the Claude tab shows the earlier windows, a network-error message, and the earlier fetch time

#### Scenario: Loading
- **WHEN** a provider has no cached result and a fetch is in progress
- **THEN** its tab shows a loading state

#### Scenario: Refreshing
- **WHEN** the user presses `r` on a tab that already shows windows
- **THEN** the header shows `refreshing…` until the fetch completes, and the windows stay visible

### Requirement: Usage fetching and refresh
The first time the Usage section becomes active in an opening, the system SHALL request usage for every supported provider, subject to the shared cache time-to-live. The `Select Model` section alone SHALL NOT trigger usage requests. Pressing `r` in the Usage section SHALL force a refresh of the active provider tab. The section SHALL re-render when a fetch completes while the modal is open. Refreshed results SHALL also be used by the custom footer.

#### Scenario: No requests from Select Model alone
- **WHEN** the user opens the modal, picks a model, and never activates `Usage`
- **THEN** the model selector makes no usage requests

#### Scenario: Cached data is reused
- **WHEN** the user activates `Usage` and a provider's cached result is still within the time-to-live
- **THEN** the cached result is shown without a new request for that provider

#### Scenario: Manual refresh
- **WHEN** the user presses `r` on the `Claude` tab
- **THEN** Claude usage is fetched again, even if the cached result is still fresh, and the tab updates when the fetch completes

### Requirement: Usage section navigation
The Usage section SHALL use Vim-style navigation (`j`/`k` and arrow keys to move between rows, `gg`/`G` for first and last row, `Esc`/`q` to close). It SHALL have no text filter. Its help footer SHALL include the refresh key hint. The `Select Model` section SHALL keep its existing host-keybinding navigation and filter input.

#### Scenario: q closes from Usage
- **WHEN** the user presses `q` while `Usage` is active with no open layer
- **THEN** the modal closes without changing the model

#### Scenario: q types in Select Model
- **WHEN** the user presses `q` while `Select Model` is active
- **THEN** `q` is added to the filter query

#### Scenario: Refresh hint shown
- **WHEN** the Usage section is active
- **THEN** the help footer includes a hint that `r` refreshes
