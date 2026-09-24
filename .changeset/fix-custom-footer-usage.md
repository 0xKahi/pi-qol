---
"@0xkahi/pi-qol": patch
---

Fix custom footer usage reporting: include usage, tool-result, branch-summary, and compaction entries in session totals; only mark subscription-backed OAuth providers as `(sub)`; keep cached Anthropic usage on failed responses; and add a 10s timeout to subscription usage requests so a hung fetch no longer blocks refreshes.
