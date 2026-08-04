# Design: Standardize Modal Rendering

## Context

Both TUI modals in pi-qol are ad-hoc `Component + Focusable` implementations. `ModelSelectDialog` (~370 lines) owns a width-aware tab strip, per-tab selection state with wrap-around, a shared filter `Input`, and two frame styles. `ContextViewDialog` owns a simpler tab line and delegates to `UsageView`/`InjectionsView`, which carry verbatim-identical navigation-dispatch (~30 lines each), preview-mode machinery, and render caches. `context-view/ui/navigation.ts` (`VimNavigation`), `layout.ts` (line fitting, hint rows), and `injections-model.ts` (`ListNavigator`, `PreviewScroller`) already exist as de-facto shared pieces, but live inside one extension. See proposal.md for motivation.

## Goals / Non-Goals

**Goals:**
- One shell (`ModalDialog`) owns everything about *being a modal*: frame, tab strip, tab cycling, layer stack, filter slot, notices slot, focus, help footer, completion.
- Tab content is a strategy interface; extensions supply data and content rendering, never modal plumbing.
- Navigation is a pluggable scheme: host-keybindings default, Vim optional.
- The library is copy-portable: imports only from Pi host packages.
- Migrate both existing dialogs with zero intended user-visible behavior change (existing `context-view` and `model-select-*` specs keep passing).

**Non-Goals:**
- One-size-fits-all configurability for hypothetical other plugins. Portability comes from self-containment, not from option sprawl.
- Modal editing modes (insert/normal) to combine Vim navigation with text filters — documented as an unsupported combination.
- Reworking what tabs render (usage map, injection tree, model rows) beyond what migration requires.
- Publishing the library as its own package.

## Decisions

### D1: Shell + tab strategy over template-method inheritance
`ModalDialog` composes `ModalTab` strategies rather than subclassing an abstract dialog. The two existing dialogs differ enough (filter input, overlays, preview layers) that a template-method base would sprout hooks and booleans; composition keeps the shell closed for modification and new modals open for extension.

**Alternatives considered:** abstract base class with template methods (rejected: inheritance rigidity); pure toolbox of helpers with no shell (rejected: standardizes parts, not behavior — navigation and dismissal could still drift between modals, which is the primary thing being standardized).

### D2: Navigation as a pure key→action scheme
```ts
type NavigationAction =
  | 'step-back' | 'step-forward'
  | 'page-back' | 'page-forward'
  | 'first' | 'last'
  | 'confirm' | 'dismiss';

interface NavigationScheme {
  consume(data: string): { handled: boolean; action?: NavigationAction };
  reset(): void;
}
```
The scheme knows nothing about the dialog. Two implementations: `PiKeybindingsScheme` (wraps `KeybindingsManager`, maps `tui.select.*` — the default, respecting user remapping) and `VimNavigationScheme` (today's `VimNavigation`, extended with enter→confirm and Esc/q→dismiss, still swallowing PageUp/PageDown/Home/End). The shell calls `reset()` on tab switches and layer push/pop so the `gg` chord never leaks across contexts.

**Rationale:** matches how each modal behaves today; per-modal choice reflects modal nature (text-entry pickers vs read-only inspectors). The interface is ~10 lines, so two schemes is not over-engineering.

### D3: Input routing order and the layer stack
```
key ─▶ shell: Tab/Shift+Tab?        → cycle tab (scheme.reset())
     ─▶ scheme.consume(key)
         ├─ action?  → top layer ?? active tab  (handleNavigation)
         └─ handled? → drop (e.g. swallowed PageUp)
     ─▶ raw key     → top layer ?? filter ?? active tab (handleInput)
```
Layers are full-screen content pushed above the active tab (previews). `dismiss` pops the top layer; with no layers it completes the dialog with the cancel value. This single rule replaces the hand-rolled preview-mode esc handling in both context views.

**Refinement made during implementation:** layer stacks are *per-tab*, not one global stack. The context-view spec requires tab switching to work while a preview is open, with each tab restoring its own preview on return — a global stack would either block switching or overlay a stale preview on the wrong tab. Tabs receive a `ModalTabContext` via `attach?()` and push layers onto their own stack; the shell routes input to the active tab's top layer.

### D4: Filter input as a shell-level slot, not a per-tab concern
Model-select's filter is *shared across tabs* — one query re-filters every tab while each retains its selection. Per-tab filters would regress that UX. The shell optionally owns one `Input` rendered between tab strip and content; it receives printable keys the scheme didn't handle and calls `applyFilter?(query)` on tabs. Constraint documented: the filter slot pairs with typing-friendly schemes only (Vim scheme + filter is unsupported — `j` cannot mean both "down" and "j").

### D5: ListNavigator shared, clamp default, wrap opt-in
`ListNavigator` moves from `injections-model.ts` into the library with a `{ wrap?: boolean }` constructor option (default clamp). Model-select opts into wrap (picker convention: fzf/VS Code wrap); inspectors clamp. Its sibling `PreviewScroller` moves with it and backs the shared preview layer.

### D6: Frame and height policies live in the shell
`frame: 'inline' | 'bordered'` reproduces model-select's two layouts (inline rules vs rounded border; host `overlayOptions` for centering stay at the call site, as today). `height: 'half'` reproduces context-view's bound: the shell computes the content viewport from `tui.terminal.rows` and hands it to tabs, instead of each view reaching for terminal rows itself.

### D7: Pre-built `ListTab` for the 80% case
A generic selectable-list tab built on `ListNavigator`, so a new "pick a thing" modal is data + a row function. Context-view's Usage/Injections remain custom tabs (map/tree rendering is genuinely bespoke) but inherit shell, scheme, layers, and navigator.

**Refinement made during implementation:** model-select's tabs were not as thin as planned — they carry a selection-description footer, per-section empty/no-match messages, always-visible favourite warnings, filter captions, a fixed 10-row window, and initial selection of the current model. `ListTab` absorbed these as options (`footer`, `filterCaption`, `emptyMessage`/`noMatchMessage`, `visibleCount`, `initialIndex`), and its footer hook renders in *all* states (list, empty, no-match) because favourite warnings must show even when the tab is empty. The result still satisfies the goal: model-select supplies only data and content hooks, zero modal plumbing.

### D8: Notices slot unifies warnings and degraded state
Model-select's config warnings and context-view's `degradedReason` are the same concept: shell renders `notices: string[]` in warning styling between tab strip and content.

### D9: Self-containment rule for portability
Everything under `src/libs/modal/` imports only from `@earendil-works/pi-tui` and `@earendil-works/pi-coding-agent` (types). No pi-qol imports (no `ConfigLoader`, schemas, constants, utils). Enforced by a dependency-audit test that scans the directory's imports. Fork-attribution headers move with the code they describe.

**Trade-off accepted:** duplicating the folder across plugins means fixes don't propagate automatically — accepted deliberately over premature packaging.

### D10: Migration order — library, then model-select, then context-view
Model-select is the simpler pilot (no layers, one scheme). Context-view follows and exercises layers, previews, notices, and the Vim scheme. Each migration step keeps its extension's test suite green before the next begins.

## Risks / Trade-offs

- [Subtle behavior drift during migration (key handling, wrap edges, cache invalidation)] → Migrate one extension at a time; run existing suites (`test/model-select`, `test/context-view`) after each step; add characterization tests for current key behavior before moving code where coverage is thin.
- [Shell accretes config knobs until it's another bespoke dialog] → Non-goal guardrail: new modal needs force new *tab strategies*, not new shell options; portability rule blocks plugin-specific concerns from entering the lib.
- [Scheme interface leaks dialog concerns over time (e.g. scheme asking about tabs)] → Keep `consume(data)` pure key→action; review rule: schemes never receive dialog state.
- [context-view fork diverges further from upstream] → Ownership of the fork was already taken (rendering changed once); attribution headers are preserved on moved code.
- [Help-footer hints and keybindings drift apart for the pi scheme] → Footer hints are declared per tab as data, shell appends universal hints; pi-scheme modals display the host's default bindings in hints (limitation accepted).

## Migration Plan

No deployment or data migration — internal refactor shipped via the normal changeset release. Rollback is `git revert`; no persisted state is touched.
