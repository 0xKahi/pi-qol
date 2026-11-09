## Why

The pi-qol Context View fork was last aligned with upstream pi-context-view v0.6.0, and upstream has since shipped fixes for silent-probe safety, capture correctness, and wheel input that very likely affect our fork as well, plus inspection features that fit pi-qol's Vim-friendly interface. Our fork also captures through Pi's plain `context` event, which no longer carries system-role messages since Pi 0.87. As a result, Injections silently misses extension-added system messages on the Pi 1.5 runtime we now target.

## What Changes

- Observe system-role messages added through Pi's system-inclusive context event and include them in the frozen Initial capture. The fork keeps its frozen-snapshot model rather than adopting upstream's latest-request capture.
- Start the silent probe only from safe states: no queued input, a real (non-virtual) model, no idle cache-warming refresh, below the auto-compaction threshold, and readable settings. Compaction must also be inactive, as today.
- Ensure the silent probe never blanks or omits other extensions' messages and never aborts their runs. When a nested user send may have taken the probe's place, report that capture ownership is ambiguous instead of silently trusting it.
- Run capture and probing only in runs whose host can actually display Context View.
- Fix mouse/trackpad wheel scrolling under Pi TUI versions that handle wheel input before extension views see it.
- Keep the Injections list height stable regardless of the selected row.
- Do not count hidden tools as available. Group path-loaded extensions under their own sources instead of one merged `cli`/`local` group.
- Add a `/` filter to the Injections tab, with `Tab` switching between name and content matching while the filter is active.
- Add `/` search in previews, with `n` and `N` moving to the next and previous match.
- Add `y` to copy the selected row or preview content to the clipboard. This deliberately differs from upstream's `c`, to match pi-qol's Vim conventions.
- Add `p` in the Usage tab to switch percentages between share of the context window and share of context used.
- Add a `context_view.auto_probing` setting, default `true`, which turns the silent initial-capture probe on or off.
- Use pi-context-view v0.8.3 at commit `60bfde29e199220bb864ce13360cf6b5dcd80695` as the upstream comparison baseline, and v0.6.0 at commit `b183316ffc7c6b7fb03ae6ecbbf783a75ee7308c` as the prior alignment point.

### Non-goals

- Excluding cache-warming refreshes from capture. Pi sends those refreshes directly from stored context without running extension context hooks, so they cannot enter this fork's capture. Idle cache warming remains a silent-probe start gate.
- Upstream's latest-request capture model, provider-payload comparison, word-level prompt-part diffs, Responses `additional_tools` payload accounting, and the Usage changes that depend on them. A possible later change will evaluate these separately.
- Pi Web or custom-host view support, per-category colour configuration, map-dimension configuration, a `/context config` command, and minimum-Pi-version registration gating.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `context-view`: Adds the `auto_probing` setting. Makes passive capture observe system-role messages, skip cache-warming and non-UI runs, and gate the silent probe on safe states without disturbing other extensions. Corrects hidden-tool and extension-source attribution in Injections. Adds Injections filtering, preview search, clipboard copy, and the Usage percentage toggle to the Vim-friendly navigation.

## Impact

- Affected feature code in `src/extensions/context-view/`: lifecycle registration (`index.ts`), capture and compaction state (`capture.ts`), probe handling, the controller, settings, attribution in the semantic model, and the Usage/Injections UI modules, including wheel handling.
- Affected shared UI code: `src/libs/modal/` needs a way for a tab or preview layer to temporarily take raw keyboard input (including `Tab`) for the filter and search prompts. It also needs to forward Pi's normalized mouse-wheel events to the active tab or layer. Existing consumers such as model selection must keep their behaviour.
- Affected configuration: the pi-qol config schema gains `context_view.auto_probing`, and the user documentation must describe the new keys and setting.
- Affected tests: Context View capture, registration, probe, controller, settings and config schema, Injections and Usage views, previews, and wheel behaviour.
- Clipboard copy depends on a Pi-provided clipboard facility being available. Where it isn't, the view must degrade with a visible notice rather than failing.
- No command, persistence-content, or layout compatibility break is intended.
