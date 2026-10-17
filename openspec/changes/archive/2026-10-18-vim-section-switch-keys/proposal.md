# Proposal

## Why

Sectioned modals switch sections with `Ctrl+]` and `Ctrl+[`, which are awkward to reach and do not match the Vim-style navigation used elsewhere in the modals. `Ctrl+L` (right) and `Ctrl+H` (left) map naturally to next and previous section.

## What Changes

- **BREAKING**: `Ctrl+L` switches to the next section and `Ctrl+H` to the previous section, wrapping in both directions. `Ctrl+]` and `Ctrl+[` no longer switch sections (replaced, not aliased).
- A raw `0x08` byte is always passed to the active section, never treated as a section switch, because legacy terminals and tmux setups send it for Backspace (and Windows Terminal for Ctrl+Backspace). `Ctrl+H` switches sections only when the terminal reports it as a distinct key sequence (Kitty, CSI-u, or modifyOtherKeys). This mirrors the existing bare-Esc guard for `Ctrl+[`, which is no longer needed for section switching.
- The section hint shown in multi-section modals becomes `^L/^H Section`.
- README section-switching docs are updated, including the note that `Ctrl+H` needs a terminal that reports it distinctly while `Ctrl+L` works everywhere.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `modal-ui`: the "Section switching keys" requirement changes its keys to `Ctrl+L`/`Ctrl+H` and replaces the bare-Esc guard with a raw-Backspace guard.

## Impact

- `src/libs/modal/sectioned-modal.ts`: key matching in `handleInput` and the extra hint text.
- `test/modal/sectioned-modal.test.ts`: key sequences and hint assertions.
- `README.md` model selector "sections" docs.
- All sectioned modals (currently `/select-model`) pick up the new keys; single-section modals are unaffected. Inside the modal, `Ctrl+L` no longer reaches Pi's global "open model selector" binding, which is harmless because the selector is already open.
