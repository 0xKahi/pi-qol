# @0xkahi/pi-qol

## 1.2.0

### Minor Changes

- d02040e: `/select-model` now opens a sectioned modal with **Select Model** and **Usage** sections. Switch sections with `Ctrl+]` / `Ctrl+[`; `Tab` still cycles tabs within a section.

  The Usage section shows every Claude and Codex subscription rate window. Each window has a progress bar, the used percentage, the time until reset, and a pace indicator (`on pace` / `ahead` / `limit`). The section also shows live "updated N ago" and reset countdowns, a `refreshing…` state, and a clear message when there is no data (not logged in, expired auth, request or network failure); `r` refreshes. The footer and the Usage section share one usage cache, OAuth tokens are resolved through Pi so expired tokens get refreshed, and the footer keeps showing the last good usage after a temporary fetch failure.

  **BREAKING:** `custom_footer.colors.anthropicUsage` and `custom_footer.colors.codexUsage` were removed. Usage colors are now fixed per provider (Claude `#D97706`, Codex `#10B981`). Configs that still set these keys load normally; the keys are ignored.

## 1.1.3

### Patch Changes

- 011c9c7: Fix custom footer usage reporting: include usage, tool-result, branch-summary, and compaction entries in session totals; only mark subscription-backed OAuth providers as `(sub)`; keep cached Anthropic usage on failed responses; and add a 10s timeout to subscription usage requests so a hung fetch no longer blocks refreshes.

## 1.1.2

### Patch Changes

- 935a321: improve workmux extension

## 1.1.1

### Patch Changes

- cf6dec5: upgrade pi deps to v0.87.0

## 1.1.0

### Minor Changes

- a51fc83: updated pi to 0.86.1 and updated context view to match pi-context-view 0.6.0

## 1.0.6

### Patch Changes

- 7ce26ca: added custom agentName to footer

## 1.0.5

### Patch Changes

- 1810591: improve context-view based on dimk90/pi-context-view v0.4.3 fork

## 1.0.4

### Patch Changes

- ed514ae: added workmux extension

## 1.0.3

### Patch Changes

- e015d46: increase pi version to v0.84.0
- a805c4a: fix auto_session_name empty user messages

## 1.0.2

### Patch Changes

- 3bc67d4: moved layout handling to its own component

## 1.0.1

### Patch Changes

- 5c0b97e: refactor: extract shared modal library (`src/libs/modal/`) powering the model-select and context-view dialogs — standardized tab strip, navigation schemes, preview layers, and help footers; no behavior change intended

## 1.0.0

### Major Changes

- 0fc6f1a: added pi context view extension

## 0.1.1

### Patch Changes

- 490308c: added default model reasoning for model select

## 0.1.0

### Minor Changes

- c60b7e9: added grouping to model_select

## 0.0.6

### Patch Changes

- fb6e04c: use dye package instead of crayon

## 0.0.5

### Patch Changes

- 3257e0d: added filter search on model-select

## 0.0.4

### Patch Changes

- a137e94: fix config schema to allow optional properties

## 0.0.3

### Patch Changes

- 8d098bb: added custom-footer extension

## 0.0.2

### Patch Changes

- 1d43976: added model-select

## 0.0.1

### Patch Changes

- 1e6b956: added auto session name extension
