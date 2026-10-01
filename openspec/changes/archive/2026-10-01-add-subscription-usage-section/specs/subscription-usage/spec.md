# Spec Delta

## Purpose

Provide shared, status-aware subscription usage data for supported AI providers: rate windows with durations, pace calculation, and a single cache used by both the custom footer and the model selector.

## ADDED Requirements

### Requirement: Supported providers
The system SHALL support subscription usage for the Anthropic (Claude) and OpenAI Codex providers. It SHALL treat the provider aliases `codex`, `openai`, and `chatgpt` as OpenAI Codex.

#### Scenario: Alias resolves to Codex
- **WHEN** usage is requested for a model whose provider is `chatgpt`
- **THEN** OpenAI Codex usage is used

#### Scenario: Unsupported provider
- **WHEN** usage is requested for a provider other than Anthropic or OpenAI Codex
- **THEN** no usage is fetched for that provider

### Requirement: Status-typed usage results
Each usage fetch SHALL produce exactly one status:
- `ok`, with at least one rate window
- `no-auth`, when no credentials are available for the provider
- `expired`, when the provider rejects the credentials with HTTP 401 or 403
- `http-error`, for any other non-success HTTP response, including the status code
- `network`, when the request fails or times out
- `unavailable`, when the response succeeds but contains no usable rate windows

The system SHALL NOT surface an exception to callers for any of these outcomes.

#### Scenario: Not logged in
- **WHEN** no credentials exist for the provider
- **THEN** the result status is `no-auth` and no HTTP request is made

#### Scenario: Rejected credentials
- **WHEN** the provider usage endpoint responds with HTTP 401
- **THEN** the result status is `expired`

#### Scenario: Server error
- **WHEN** the provider usage endpoint responds with HTTP 500
- **THEN** the result status is `http-error` with status code 500

#### Scenario: Request timeout
- **WHEN** the request does not complete within the fetch timeout
- **THEN** the result status is `network`

#### Scenario: Response without windows
- **WHEN** the response is successful but contains no recognizable rate windows
- **THEN** the result status is `unavailable`

#### Scenario: Malformed response body
- **WHEN** the response is successful but its body is not valid JSON
- **THEN** the result status is `unavailable`

### Requirement: Credential resolution
The system SHALL resolve provider credentials through the host's provider authentication, so credentials the host refreshes are used. It SHALL send any provider account identifier the host makes available along with the request.

#### Scenario: Host provides credentials
- **WHEN** the host has usable credentials for a supported provider
- **THEN** the usage request is authorized with those credentials

#### Scenario: Host has no credentials
- **WHEN** the host has no credentials for a supported provider
- **THEN** the result status is `no-auth`

### Requirement: Rate windows with duration
Each rate window SHALL include a label, a used percentage, an optional reset time, and a window duration when known. Claude windows SHALL use 5 hours for the `5h` window and 7 days for the `Week` window. Codex windows SHALL use the duration the provider reports, falling back to the existing primary and secondary defaults when none is reported. Every Codex window the provider returns SHALL be included, additional per-feature limits among them.

#### Scenario: Claude window durations
- **WHEN** a Claude usage response contains five-hour and seven-day utilization
- **THEN** the windows `5h` and `Week` have durations of 5 hours and 7 days respectively

#### Scenario: Codex additional limits are kept
- **WHEN** a Codex usage response includes additional rate limits
- **THEN** a window for each additional limit is included, labelled with its limit name

### Requirement: Pace calculation
For a window with both a duration and a reset time, the system SHALL compute the elapsed percentage as the share of the duration already elapsed, `100 * (1 - (resetAt - now) / duration)`, clamped to 0-100. It SHALL classify the window as:
- `limit`, when the used percentage is at least 100
- `ahead`, when the used percentage is greater than the elapsed percentage
- `on-pace`, otherwise

When the duration or reset time is unknown, the pace SHALL be unknown.

#### Scenario: Ahead of pace
- **WHEN** a 7-day window is 81% used and resets in 3 days
- **THEN** the elapsed percentage is about 57% and the pace is `ahead`

#### Scenario: On pace
- **WHEN** a 5-hour window is 30% used and resets in 2 hours
- **THEN** the elapsed percentage is 60% and the pace is `on-pace`

#### Scenario: Limit reached
- **WHEN** a window is 100% used
- **THEN** the pace is `limit`

#### Scenario: Unknown reset
- **WHEN** a window has no reset time
- **THEN** the pace is unknown

### Requirement: Shared usage cache
The system SHALL keep one usage cache per plugin instance, shared by every consumer. For each provider the cache SHALL hold the latest result, the time of the latest successful fetch, and the latest successful windows. It SHALL start at most one fetch at a time per provider, and SHALL start a fetch only when the provider's last fetch is older than the cache time-to-live, unless a refresh is forced. A forced refresh SHALL fetch immediately unless a fetch for that provider is already in progress. Consumers SHALL be notified when a fetch completes.

#### Scenario: Consumers share results
- **WHEN** the footer triggers a fetch for a provider and the model selector later reads that provider within the time-to-live
- **THEN** the model selector gets the cached result without a new request

#### Scenario: Concurrent requests are deduplicated
- **WHEN** two consumers request the same provider while a fetch is in progress
- **THEN** only one request is made

#### Scenario: Forced refresh bypasses the time-to-live
- **WHEN** a consumer forces a refresh for a provider whose cached result is still fresh
- **THEN** a new request is made

#### Scenario: Failure keeps the last good windows
- **WHEN** a provider had a successful result and a later fetch fails
- **THEN** the cache reports the failure status and still provides the last successful windows and their fetch time

### Requirement: Fixed provider usage colors
The system SHALL use one fixed usage color per supported provider (Claude `#D97706`, Codex `#10B981`) for every subscription usage display. It SHALL NOT offer configuration options for these colors.

#### Scenario: Same color everywhere
- **WHEN** Claude usage is shown in the footer and in the model selector Usage section with color output enabled
- **THEN** both use `#D97706` for the colored parts

#### Scenario: Former color keys are ignored
- **WHEN** a config file still sets `custom_footer.colors.anthropicUsage`
- **THEN** the config loads without a validation error and the fixed Claude color is used

### Requirement: Footer tolerance of failures
The custom footer SHALL keep showing the single soonest-resetting window for the current subscription model's provider when the latest result is `ok`. When the latest result is `network`, `http-error`, or `unavailable` and earlier successful windows exist, the footer SHALL show the soonest-resetting window from those windows. It SHALL hide the subscription usage segment for `no-auth` and `expired`, and whenever no successful windows exist.

#### Scenario: Footer hides on auth failure
- **WHEN** the latest result for the current provider is `expired`
- **THEN** the footer shows no subscription usage segment

#### Scenario: Footer keeps last good data on a temporary failure
- **WHEN** the current provider had a successful result and the latest fetch failed with `network`
- **THEN** the footer shows the soonest-resetting window from the last successful result

#### Scenario: Temporary failure without earlier data
- **WHEN** the latest result is `http-error` and no successful result exists
- **THEN** the footer shows no subscription usage segment

#### Scenario: Footer unchanged on success
- **WHEN** the latest result for the current provider is `ok`
- **THEN** the footer shows the window with the soonest reset, as before this change
