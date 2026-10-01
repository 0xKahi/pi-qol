---
"@0xkahi/pi-qol": minor
---

`/select-model` now opens a sectioned modal with **Select Model** and **Usage** sections. Switch sections with `Ctrl+]` / `Ctrl+[`; `Tab` still cycles tabs within a section.

The Usage section shows every Claude and Codex subscription rate window. Each window has a progress bar, the used percentage, the time until reset, and a pace indicator (`on pace` / `ahead` / `limit`). The section also shows live "updated N ago" and reset countdowns, a `refreshing…` state, and a clear message when there is no data (not logged in, expired auth, request or network failure); `r` refreshes. The footer and the Usage section share one usage cache, OAuth tokens are resolved through Pi so expired tokens get refreshed, and the footer keeps showing the last good usage after a temporary fetch failure.

**BREAKING:** `custom_footer.colors.anthropicUsage` and `custom_footer.colors.codexUsage` were removed. Usage colors are now fixed per provider (Claude `#D97706`, Codex `#10B981`). Configs that still set these keys load normally; the keys are ignored.
