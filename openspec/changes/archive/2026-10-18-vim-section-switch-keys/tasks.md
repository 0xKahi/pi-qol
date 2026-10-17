# Tasks

## 1. Section switching keys

- [x] 1.1 In `src/libs/modal/sectioned-modal.ts` `handleInput`, switch to the next section on `ctrl+l` and to the previous section on `ctrl+h` only when `data !== '\x08'`, and remove the `ctrl+]`/`ctrl+[` handling; verify with `test/modal/sectioned-modal.test.ts` that `\x0c` and `\x1b[108;5u` go next with wrap and `\x1b[104;5u` goes previous with wrap
- [x] 1.2 Add tests that a raw `\x08` reaches the active section (for example, it deletes a filter character) without changing section, and that `\x1d` and `\x1b[91;5u` no longer change section; verify with `bun test test/modal/sectioned-modal.test.ts`
- [x] 1.3 Change the extra hint to `['^L/^H', 'Section']` and update the hint assertions; verify the test asserts `^L/^H Section` for multi-section modals and no `Section` hint for single-section modals
- [x] 1.4 Update README.md section-switching docs (Ctrl+L next, Ctrl+H previous, both wrap; Ctrl+H needs a terminal that reports it distinctly, otherwise it acts as Backspace) and any `src/libs/modal/codemap.md` mention of the keys; verify by reading the rendered sections

## 2. Verification

- [x] 2.1 Run `bun test`, `bun run type-check`, and `bun run lint`, and verify all pass
