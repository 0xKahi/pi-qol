# Proposal

## Why

OpenCode Go is a flat-rate subscription with 5-hour, weekly, and monthly spending limits, but the plugin only shows subscription usage for Claude and Codex. Go users cannot see how close they are to a limit, and because Go authenticates with an API key rather than OAuth, the footer does not even treat Go models as subscription models.

## What Changes

- Add OpenCode Go (model provider `opencode-go`) as a third supported subscription usage provider, labelled `OC-GO`, fetching `GET https://opencode.ai/console/api/go/status` with the stored API key as a bearer token.
- Map the response's `fiveHour`, `week`, and `month` meters to `5h`, `Week`, and `Month` rate windows with used percentages (used / limit), reset times, and durations derived from the response.
- Make credential acceptance provider-specific: Claude and Codex still accept only `oauth` entries in `auth.json`; OpenCode Go accepts only `api_key` entries. Credentials still require an `auth.json` entry for the provider; environment variables alone never enable usage.
- Treat `opencode-go` models as subscription models in the custom footer, so the cost shows ` (sub)` and the subscription usage segment appears.
- Add a `[OC-GO]` tab to the model selector Usage section, after `[Claude]` and `[Codex]`.
- Use the fixed usage color `#00ADD8` for OpenCode Go.
- Out of scope: showing dollar amounts, the OpenCode Zen provider (`opencode`), and env-var-only credentials.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `subscription-usage`: adds OpenCode Go to the supported providers, provider-specific credential types, OpenCode Go rate windows, its fixed color, and footer subscription status for OpenCode Go models.
- `model-select-sections`: the Usage section tab list becomes `[Claude]`, `[Codex]`, `[OC-GO]`.
- `custom-footer-terminal-styling`: the fixed per-provider usage color list includes OpenCode Go `#00ADD8`.

## Impact

- `src/libs/subscription-usage/`: new OpenCode Go strategy, provider type and provider list, provider alias resolution, strategy selection in the cache, credential resolver auth-type gating and `key` fallback, provider color.
- `src/extensions/custom-footer/footer-component.ts`: subscription detection for `opencode-go`.
- Model selector Usage section picks up the new tab through the shared provider list; no structural change expected.
- Tests under `test/subscription-usage/`, `test/custom-footer/`, `test/model-select/`; README subscription usage docs.
- New outbound request to `opencode.ai` for users with an `opencode-go` API key in `auth.json`.
