# src/extensions/model-select/usage-section/

## Responsibility

Read-only subscription usage section of the model selector, consuming the same injected cache as the custom footer.

## Modules

- `index.ts`: `createUsageSection` builds an embedded Vim-navigated dialog with bracketed `[Claude]`/`[Codex]` tabs, preselects the current supported provider (else Claude), and requests every provider on first activation through the section host.
- `usage-provider-tab.ts`: `UsageProviderTab` renders provider status, freshness, all rate windows, progress/reset/pace rows, and retained row navigation using `ListNavigator`. Failures preserve last-success windows and their original fetch time. Raw `r` forces active-provider refresh. The injected clock keeps relative times testable. Window rows have one blank separator, with `ListNavigator` still selecting windows rather than separator lines; bounded views budget two lines per visible window minus the final separator. Provider names, labels, bar fills, and percentages use the fixed `providerUsageColor` palette from the subscription-usage library and cli-dye; empty bars and reset text are dim. Model-select does not depend on footer internals or color configuration. The render cache keys on whole seconds, result, in-flight state, last success, and viewport, while navigation/theme changes invalidate it. In-flight fetches with displayed windows show `refreshing…` and retain the rows.

## Lifecycle

`ModelSelectModal` owns the cache subscription and a 1s interval that requests renders only while Usage is active. Either section's completion or host `dispose()` clears both resources through idempotent cleanup. Select Model alone never fetches usage or requests timed renders. Cache completion requests a render; visible ticks update freshness and reset countdowns without input.
