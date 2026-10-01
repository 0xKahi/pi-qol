# Proposal

## Why

The provider usage APIs return every rate window (for example Claude's 5h and weekly limits, and Codex's primary, secondary, and per-feature limits). The footer shows only one of them: the window that resets soonest, for the current model's provider, and only when that model uses a subscription. There is no way to see all windows, to see other providers, to tell whether you are using quota faster than the window allows, or to find out why usage is missing. Auth, HTTP, and network failures all hide the segment the same way. The model selector is where users decide which model to use next, so usage information belongs there.

## What Changes

- Add a **sectioned modal** to the shared modal library. A section is a full embedded modal with its own tabs, navigation scheme, filter, title, notices, and hints. Sections sit one level above tabs.
  - `Ctrl+]` moves to the next section and `Ctrl+[` to the previous one. Both wrap around.
  - A bare `\x1b` byte always means Esc (dismiss), never a section switch. In terminals without the Kitty protocol, `Ctrl+[` therefore acts as Esc.
  - `Tab`/`Shift+Tab` keep cycling tabs inside the active section.
  - The section strip is drawn inside the modal's top rule (inline frame) or top border (bordered frame). Tabs render in the body, so the two strips look distinct and the strip adds no height.
  - Each section keeps its state (tab, selection, filter query, open layers) while another section is active.
- Turn `/select-model` into a sectioned modal with two sections, **Select Model** (opens first) and **Usage**. The `pi.vimKeys.event:pi-qol.model_select` event opens the same sectioned modal.
- Add a **Usage section**:
  - One tab per supported subscription provider (Claude, Codex).
  - Every rate window for that provider, each with a progress bar, used percentage, time to reset, and a pace indicator comparing used percentage with the elapsed share of the window.
  - An "updated N ago" line.
  - `r` to refresh.
  - Vim navigation.
  - An explicit per-provider state when data is missing: not logged in, expired auth, request failure, or network failure.
- Move the **subscription usage cache** out of the custom footer into the shared `libs/subscription-usage` module. The footer and the Usage section share one instance, so they do not fetch the same data twice.
- Usage fetches return a **status result** instead of `undefined`. Rate windows gain a window duration so pace can be computed. The footer keeps its current behavior and hides the segment for any status other than success.
- **BREAKING (minor):** remove the `custom_footer.colors.anthropicUsage` and `custom_footer.colors.codexUsage` config options. Provider usage colors become fixed defaults owned by the shared usage library (Claude `#D97706`, Codex `#10B981`), used by both the footer and the Usage section. Existing configs that set these keys still load; the keys are ignored.
- No other configuration changes.

## Capabilities

### New Capabilities
- `subscription-usage`: Shared subscription usage data: provider strategies, status-typed fetch results, window durations, pace calculation, and a shared TTL cache with in-flight deduplication and forced refresh, used by both the footer and the model selector.
- `model-select-sections`: The `/select-model` modal and its event trigger open a sectioned modal with a Select Model section (initially active) and a Usage section. Covers Usage section content, per-provider states, refresh, and navigation.

### Modified Capabilities
- `custom-footer-terminal-styling`: The subscription usage segment uses fixed per-provider colors instead of configured ones.
- `modal-ui`: Adds sectioned-modal requirements: section shell, section key routing (including the bare-Esc rule), section strip drawn in the frame, per-section state retention, embedded dialogs, and section hints in the help footer. Existing single-dialog behavior does not change.

## Impact

- `src/libs/modal/`: new sectioned modal host and frame-embedded section strip. `ModalDialog` gains an embedded mode (no frame of its own; the host supplies extra footer hints). The self-containment rule still holds.
- `src/libs/subscription-usage/`: gains the shared cache manager (moved from `src/extensions/custom-footer/subscription-usage-manager.ts`), status result types, window durations, and pace math. Strategies populate window durations.
- `src/extensions/custom-footer/`: consumes the shared cache and status results. Rendering does not change.
- `src/extensions/model-select/`: opens the sectioned modal and adds the Usage section UI. Applying the selected model does not change.
- Tests under `test/modal/`, `test/model-select/`, and the footer and subscription-usage suites.
- `src/schemas/custom-footer-config.schema.ts`, `assets/config.schema.json` (regenerated), and the README footer colors table: the two usage color keys are removed.
- No new dependencies.
