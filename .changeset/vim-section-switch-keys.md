---
"@0xkahi/pi-qol": patch
---

Switch model selector sections with Vim-style keys: `Ctrl+L` moves to the next section and `Ctrl+H` to the previous one, both wrapping. `Ctrl+]` and `Ctrl+[` no longer switch sections. `Ctrl+H` needs a terminal that reports it as its own key (Kitty, CSI-u, or modifyOtherKeys); otherwise it stays Backspace. The section hint now reads `^L/^H Section`.
