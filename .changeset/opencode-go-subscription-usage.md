---
"@0xkahi/pi-qol": minor
---

Add OpenCode Go (`opencode-go`) subscription usage: a new `[OC-GO]` Usage tab in the model selector and an OC-GO footer segment with 5h, Week, and Month windows from the OpenCode Go status API (color `#00ADD8`). OpenCode Go reads an `api_key` entry from `auth.json`, while Claude and Codex still require `oauth` entries. `opencode-go` models now show ` (sub)` in the footer cost. OpenCode Zen (`opencode`) is unchanged.
