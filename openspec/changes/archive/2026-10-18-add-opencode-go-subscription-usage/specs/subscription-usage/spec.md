## MODIFIED Requirements

### Requirement: Supported providers
The system SHALL support subscription usage for the Anthropic (Claude), OpenAI Codex, and OpenCode Go providers. It SHALL treat the provider aliases `codex`, `openai`, and `chatgpt` as OpenAI Codex. It SHALL treat only the provider `opencode-go` as OpenCode Go; the OpenCode Zen provider `opencode` SHALL NOT be treated as a subscription usage provider.

#### Scenario: Alias resolves to Codex
- **WHEN** usage is requested for a model whose provider is `chatgpt`
- **THEN** OpenAI Codex usage is used

#### Scenario: OpenCode Go provider
- **WHEN** usage is requested for a model whose provider is `opencode-go`
- **THEN** OpenCode Go usage is used

#### Scenario: OpenCode Zen is not supported
- **WHEN** usage is requested for a model whose provider is `opencode`
- **THEN** no usage is fetched for that provider

#### Scenario: Unsupported provider
- **WHEN** usage is requested for a provider other than Anthropic, OpenAI Codex, or OpenCode Go
- **THEN** no usage is fetched for that provider

### Requirement: Credential resolution
The system SHALL resolve provider credentials through the host's provider authentication, so credentials the host refreshes are used, falling back to the secret stored in `auth.json` when host resolution fails. Credentials SHALL be used only when `auth.json` has an entry for the provider whose type the provider accepts: `oauth` for Claude and Codex, `api_key` for OpenCode Go. It SHALL send any provider account identifier the host makes available along with the request.

#### Scenario: Host provides credentials
- **WHEN** the host has usable credentials for a supported provider and `auth.json` has an entry of an accepted type
- **THEN** the usage request is authorized with those credentials

#### Scenario: Host has no credentials
- **WHEN** the host has no credentials for a supported provider
- **THEN** the result status is `no-auth`

#### Scenario: Claude API key is not a subscription
- **WHEN** the `auth.json` entry for `anthropic` has type `api_key`
- **THEN** the result status is `no-auth` and no HTTP request is made

#### Scenario: OpenCode Go API key
- **WHEN** the `auth.json` entry for `opencode-go` has type `api_key` with a key
- **THEN** the OpenCode Go usage request is authorized with that key as a bearer token

#### Scenario: OpenCode Go OAuth entry is rejected
- **WHEN** the `auth.json` entry for `opencode-go` has type `oauth`
- **THEN** the result status is `no-auth`

#### Scenario: Environment variable alone is not used
- **WHEN** `OPENCODE_API_KEY` is set but `auth.json` has no `opencode-go` entry
- **THEN** the result status is `no-auth` and no HTTP request is made

#### Scenario: Stored key fallback
- **WHEN** host credential resolution fails for `opencode-go` and the `auth.json` entry has a key
- **THEN** the usage request is authorized with the stored key

### Requirement: Rate windows with duration
Each rate window SHALL include a label, a used percentage, an optional reset time, and a window duration when known. Claude windows SHALL use 5 hours for the `5h` window and 7 days for the `Week` window. Codex windows SHALL use the duration the provider reports, falling back to the existing primary and secondary defaults when none is reported. Every Codex window the provider returns SHALL be included, additional per-feature limits among them. OpenCode Go windows SHALL follow the OpenCode Go rate windows requirement.

#### Scenario: Claude window durations
- **WHEN** a Claude usage response contains five-hour and seven-day utilization
- **THEN** the windows `5h` and `Week` have durations of 5 hours and 7 days respectively

#### Scenario: Codex additional limits are kept
- **WHEN** a Codex usage response includes additional rate limits
- **THEN** a window for each additional limit is included, labelled with its limit name

### Requirement: Fixed provider usage colors
The system SHALL use one fixed usage color per supported provider (Claude `#D97706`, Codex `#10B981`, OpenCode Go `#00ADD8`) for every subscription usage display. It SHALL NOT offer configuration options for these colors.

#### Scenario: Same color everywhere
- **WHEN** Claude usage is shown in the footer and in the model selector Usage section with color output enabled
- **THEN** both use `#D97706` for the colored parts

#### Scenario: OpenCode Go color
- **WHEN** OpenCode Go usage is shown in the footer or the model selector Usage section with color output enabled
- **THEN** the colored parts use `#00ADD8`

#### Scenario: Former color keys are ignored
- **WHEN** a config file still sets `custom_footer.colors.anthropicUsage`
- **THEN** the config loads without a validation error and the fixed Claude color is used

## ADDED Requirements

### Requirement: OpenCode Go rate windows
The system SHALL map the OpenCode Go meters `fiveHour`, `week`, and `month` to windows labelled `5h`, `Week`, and `Month`, in that order. The used percentage SHALL be the used amount divided by the limit, times 100. The reset time SHALL be the meter's reset time. A meter missing a positive limit, a used amount, or a valid reset time SHALL be skipped. A response with no access or no usable meters SHALL yield no windows.

#### Scenario: Meters become windows
- **WHEN** the response has a `fiveHour` meter with limit `1200000000` and used `22118184`
- **THEN** a `5h` window is included with a used percentage of about 1.8% and the meter's reset time

#### Scenario: Amounts given as strings
- **WHEN** meter limit and used amounts are JSON strings of digits
- **THEN** they are parsed as numbers and the window is included

#### Scenario: Unusable meter is skipped
- **WHEN** a meter has a limit of `0` or no reset time
- **THEN** no window is included for that meter and the other meters are still included

#### Scenario: No subscription access
- **WHEN** the response has no `access` meters
- **THEN** the result status is `unavailable`

### Requirement: OpenCode Go window durations
Each OpenCode Go window duration SHALL be the meter's reset time minus its start time. When the `fiveHour` or `week` meter has no usable start time, the duration SHALL be 5 hours or 7 days respectively. The `month` meter SHALL use the subscription period start (`access.startsAt`) as its start time; when that is missing, the `Month` window duration SHALL be unknown, so its pace is unknown.

#### Scenario: Duration from the response
- **WHEN** the `week` meter starts at `2026-10-12T00:00:00Z` and resets at `2026-10-19T00:00:00Z`
- **THEN** the `Week` window duration is 7 days

#### Scenario: Month uses the subscription period
- **WHEN** the subscription period starts `2026-09-29T18:47:39Z` and the `month` meter resets `2026-10-29T18:47:39Z`
- **THEN** the `Month` window duration is 30 days

#### Scenario: Month without a period start
- **WHEN** the response has no subscription period start
- **THEN** the `Month` window is included with an unknown duration and its pace is unknown

#### Scenario: Five-hour fallback
- **WHEN** the `fiveHour` meter has no start time
- **THEN** the `5h` window duration is 5 hours

### Requirement: OpenCode Go models are subscription models
The custom footer SHALL treat a model whose provider is `opencode-go` as a subscription model, so the cost is marked as a subscription and the subscription usage segment is shown according to the footer tolerance rules.

#### Scenario: Footer on OpenCode Go
- **WHEN** the current model's provider is `opencode-go` and the latest OpenCode Go result is `ok`
- **THEN** the footer marks the cost with ` (sub)` and shows the soonest-resetting OpenCode Go window

#### Scenario: OpenCode Zen unchanged
- **WHEN** the current model's provider is `opencode`
- **THEN** the footer does not mark the cost as a subscription and shows no subscription usage segment
