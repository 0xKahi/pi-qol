## Why

The pi-qol Context View fork predates correctness, accounting, performance, and inspection improvements released by upstream pi-context-view. Adopting the applicable improvements while preserving pi-qol's unified tabbed modal will make silent capture safer, context totals more trustworthy, and long captured entries fully inspectable.

## What Changes

- Make the silent Initial-capture probe compatible with Pi 0.84 abort reporting and prevent it from starting while session compaction is active.
- Include Pi's configured auto-compaction reserve in Usage totals and the proportional context map.
- Avoid rebuilding expensive frozen Initial-capture inputs on every later context event.
- Attribute shared tool guideline text once and expose labeled, token-measured sections in tool previews.
- Display the token size and proportional share represented by each context-map cell.
- Replace the flat, capped chronological category preview with a block-aware stream: each captured entry is a selectable capped block, and truncated blocks can open a nested full-content preview.
- Adapt upstream behavior to pi-qol's retained Usage/Injections tabs, Vim navigation, half-height bound, and shared modal preview-layer stack rather than replacing those fork-specific behaviors.
- Use pi-context-view v0.4.3 at commit `fefb71efc88bab5b959053dd023825d514f39946` as the upstream comparison baseline for this change.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `context-view`: Strengthen passive capture and Usage accounting, add clearer map/tool detail, and make chronological Usage content navigable and fully inspectable by entry.

## Impact

- Affected feature code: `src/extensions/context-view/` capture, controller, measurement, semantic model, usage calculation, and Usage/Injections UI modules.
- Affected shared UI code: `src/libs/modal/` preview-layer/navigation contracts may need a block-selectable nested-layer strategy while preserving existing consumers.
- Affected tests: Context View capture, registration/controller, measurement, usage-map, Usage view, and modal layer behavior.
- Pi settings access is added at view-open time to read the effective auto-compaction reserve; unreadable settings degrade to omitting the buffer rather than failing Context View.
- The package now requires Pi 0.84.3 or newer within the 0.84 release line so failed compactions have a guaranteed lifecycle settlement event.
- No command, configuration, persistence-content, or layout compatibility break is intended.
