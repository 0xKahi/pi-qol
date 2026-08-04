# Tasks: Standardize Modal Rendering

## 1. Library skeleton

- [x] 1.1 Create `src/libs/modal/` directory structure (`navigation/`, `tabs/`) with barrel exports
- [x] 1.2 Define the `NavigationAction` union and `NavigationScheme` interface (`consume`, `reset`)
- [x] 1.3 Define the `ModalTab` strategy interface (label getter, `render`, `handleInput`, `handleNavigation`, `applyFilter?`, `hints`, `invalidate`)
- [x] 1.4 Move `ListNavigator` and `PreviewScroller` from `context-view/ui/injections-model.ts` into the library, preserving fork-attribution headers; add `{ wrap?: boolean }` option (default clamp) to `ListNavigator`
- [x] 1.5 Move line-fitting/hint helpers from `context-view/ui/layout.ts` into the library (`fitLine`, `spreadLine`, `hintRow`, `wrapDescriptionLines`, viewport/height helpers), preserving attribution headers
- [x] 1.6 Add a dependency-audit test asserting every import in `src/libs/modal/` resolves to a Pi host package or within the directory

## 2. Navigation schemes

- [x] 2.1 Implement `VimNavigationScheme` by moving and extending `context-view/ui/navigation.ts`: map Enter→`confirm`, Esc/`q`→`dismiss`; keep swallowing PageUp/PageDown/Home/End; preserve attribution header
- [x] 2.2 Implement `PiKeybindingsScheme` wrapping `KeybindingsManager` (`tui.select.up/down/pageUp/pageDown/confirm/cancel` → actions)
- [x] 2.3 Unit-test both schemes: action mapping, unhandled-key fallthrough, `gg` chord state, `reset()` clearing pending chords

## 3. ModalDialog shell

- [x] 3.1 Implement `ModalDialog` as `Component + Focusable`: constructor takes `TUI`, `Theme`, `KeybindingsManager`, options (tabs, scheme default `PiKeybindingsScheme`, frame, height, filter, notices, cancel value); owns focus plumbing and invalidate fan-out
- [x] 3.2 Implement input routing per design D3: tab cycling (Tab/Shift+Tab, wrap, scheme reset), scheme consumption, layer-then-tab dispatch
- [x] 3.3 Implement the layer stack: `pushLayer`/`popLayer`, dismissal pops top layer before completing the dialog
- [x] 3.4 Implement frames: `inline` (horizontal rules) and `bordered` (rounded border); `height: 'half'` bounds content to `floor(rows/2) - 1` and passes the viewport to tabs
- [x] 3.5 Port the width-aware tab strip from `ModelSelectDialog` (active highlight, `…` overflow windowing, dynamic label getters)
- [x] 3.6 Implement the optional filter slot: shell-owned `Input` between strip and content, receives unhandled printable keys, calls `applyFilter?` on all tabs, retains one shared query
- [x] 3.7 Implement the notices slot (warning-styled lines under the tab strip) and the help footer (active tab hints + universal hints)

## 4. Pre-built tab and layer implementations

- [x] 4.1 Implement generic `ListTab` (items, row renderer, confirm callback, `ListNavigator` with wrap option, scroll-window rendering)
- [x] 4.2 Implement `PreviewLayer` (wrapped text, `PreviewScroller`, navigation-action scrolling, dismiss pops)
- [x] 4.3 Unit-test shell, `ListTab`, and `PreviewLayer` (tab cycling, retained state, dismissal order, filter notification, clamp/wrap bounds)

## 5. Migrate model-select (pilot)

- [x] 5.1 Add characterization tests for current dialog behavior where coverage is thin (tab cycling, wrap-around selection, shared filter query, esc/enter handling)
- [x] 5.2 Rewrite `ModelSelectDialog` as `ModalDialog` configuration: `ListTab` instances with `{ wrap: true }`, filter slot, notices for config warnings, dynamic tab labels with filtered counts, both frame styles; preserve the overlay `ctx.ui.custom` call-site options
- [x] 5.3 Delete absorbed code from `model-select-dialog.ts` (tab strip, `wrapIndex`, `line`/`padLine`, selection math)
- [x] 5.4 Verify `test/model-select` passes and manually smoke-test `/select-model` inline and overlay layouts

## 6. Migrate context-view

- [x] 6.1 Rewrite `ContextViewDialog` as `ModalDialog` configuration: Vim scheme, `height: 'half'`, notices for `degradedReason`, two retained custom tabs
- [x] 6.2 Refactor `UsageView` and `InjectionsView` into `ModalTab` implementations: delete the duplicated navigation-dispatch chains, preview-mode state, and render-cache duplication absorbed by the library; previews become `PreviewLayer` pushes
- [x] 6.3 Remove `context-view/ui/navigation.ts` and `layout.ts` (now in the library); update imports; keep `z` map-zoom and other tab-specific keys in the tabs
- [x] 6.4 Verify `test/context-view` passes and manually smoke-test `/context-view` (tab cycling, previews, esc ordering, half-height)

## 7. Wrap-up

- [x] 7.1 Run `bun run lint`, `bun run type-check`, and the full test suite
- [x] 7.2 Update codemaps affected by the moves (`src/extensions/context-view/ui/codemap.md`, `model-select` codemap, add `src/libs/modal/` map)
- [x] 7.3 Add a changeset describing the internal refactor
