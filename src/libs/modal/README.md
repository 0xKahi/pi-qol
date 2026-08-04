# Modal UI Library

Build a consistent TUI modal for a Pi extension without rewriting modal plumbing. You supply **tab content**; the shell supplies everything else — frame, tab strip, tab cycling, navigation, filtering, previews, dismissal, focus, and the help footer.

**Self-containment rule:** this directory imports only from Pi host packages (`@earendil-works/pi-tui`, `@earendil-works/pi-coding-agent` types). Never import plugin-specific modules here — `test/modal/dependency-audit.test.ts` enforces it, and it's what makes this folder copy-portable to other Pi plugins.

## 60-second quickstart

A minimal "pick a thing" modal:

```ts
import type { ExtensionCommandContext } from '@earendil-works/pi-coding-agent';
import { ListTab, ModalDialog } from './libs/modal/index.js'; // adjust path

async function openPicker(ctx: ExtensionCommandContext) {
  let dialog: ModalDialog<string | null>;
  const result = await ctx.ui.custom<string | null>((tui, theme, keybindings, done) => {
    dialog = new ModalDialog<string | null>(tui, theme, keybindings, {
      tabs: [
        new ListTab(theme, {
          label: counts => `[Branches ${counts.filtered}]`,
          items: ['main', 'develop', 'feature-x'],
          renderRow: (item, selected) => `${selected ? '→ ' : '  '}${item}`,
          // `dialog` is assigned before any key can be pressed, so the
          // closure safely completes the dialog with the picked value:
          onConfirm: item => dialog.complete(item),
        }),
      ],
      cancelValue: null,
      onComplete: done,
    });
    return dialog;
  });
  // result === selected item, or null when the user pressed Esc
}
```

That's the whole job. The shell gives you: Esc-to-cancel, `↑↓`/PgUp/PgDn via the user's own keybindings, Enter-to-confirm, a tab strip, and a help footer.

## Concepts

```
┌──────────────────────────────────────────────┐
│ frame: 'inline' rules | 'bordered' rounded   │  ← shell
│ ┌──────────────────────────────────────────┐ │
│ │ title? (string | () => string)           │ │  ← shell option
│ │ tab strip  [One 3]  [Two 12]             │ │  ← shell, labels live
│ │ ⚠ notices?                               │ │  ← shell option
│ │ filter caption? + filter input?          │ │  ← shell option + tab caption
│ │                                          │ │
│ │   content: active tab, or its top layer  │ │  ← YOUR code
│ │                                          │ │
│ │ ↑↓ Navigate · Enter Select · Esc Close   │ │  ← shell footer
│ └──────────────────────────────────────────┘ │
└──────────────────────────────────────────────┘

Input routing (first match wins):
  1. Tab / Shift+Tab            → cycle tabs (wraps; scheme resets)
  2. navigation scheme          → semantic action:
       dismiss                  → pop active tab's top layer, else cancel dialog
       step/page/first/last/    → top layer, else active tab
       confirm
  3. raw key                    → top layer, else filter input, else active tab
```

Three interfaces cover all content:

- **`ModalTab`** — one tab of content (usually you use the pre-built `ListTab` instead of writing your own).
- **`ModalLayer`** — full-content overlay above a tab (usually the pre-built `PreviewLayer`). Each tab has its **own** layer stack: Tab-switching works while a layer is open, and each tab restores its layer when you return.
- **`NavigationScheme`** — pure key→action mapper. Default: `PiKeybindingsScheme` (follows the user's `tui.select.*` remappings). Alternative: `VimNavigationScheme` (`j/k`, `Ctrl+u/d`, `gg/G`, `q`) for read-only inspectors.

## Recipes

### Filterable picker (model-select style)

```ts
const tab = new ListTab<ModelItem>(theme, {
  label: counts => `[Models ${counts.filtered}]`,   // re-read every render
  items,
  filterText: item => item.searchText,              // enables fuzzy filtering
  filterCaption: () => [theme.fg('muted', 'Filter:')], // line(s) above the input
  emptyMessage: 'No models available.',             // items.length === 0
  noMatchMessage: 'No matching models',             // filter hides everything
  wrap: true,                                       // wrap selection at ends (picker convention)
  visibleCount: 10,                                 // fixed window (default: fill height)
  initialIndex: currentIndex,                       // preselect the current entry
  renderRow: (item, selected) => ...,
  footer: ({ selected }) => selected ? ['', theme.fg('muted', `  ${selected.description}`)] : [],
  onConfirm: item => dialog.complete(item.model),
});

new ModalDialog(tui, theme, keybindings, {
  tabs: [tab],
  filter: { initialQuery: '' },                     // one query shared across ALL tabs
  title: () => `${theme.bold('Select Model')}`,
  notices: configWarnings,                          // '⚠'-prefixed, warning-styled
  maxNoticeLines: 4,                                // overflow becomes "N more warning(s)"
  cancelValue: null,
  onComplete: done,
});
```

`footer` runs in **all** states (list, empty, no-match) — use it for things like config warnings that must always show.

### Read-only inspector with Vim keys and previews (context-view style)

```ts
new ModalDialog<undefined>(tui, theme, keybindings, {
  tabs: [new UsageView(theme, input), new InjectionsView(theme, input)],
  navigation: new VimNavigationScheme(),   // j/k, Ctrl+u/d, gg/G, q
  height: 'half',                          // bound to half the terminal; tabs get exact content height
  notices: degradedReason ? [degradedReason] : [],
  cancelValue: undefined,
  onComplete: done,
});
```

A custom tab opens a preview by pushing a layer via the context it receives in `attach`:

```ts
class InspectorTab implements ModalTab {
  private context: ModalTabContext | undefined;
  private readonly navigator = new ListNavigator(this.rows.length, 1);
  private readonly cache = new RenderCache();

  get label() { return '[Inspector]'; }
  attach(context: ModalTabContext) { this.context = context; }
  hints() { return [['Enter', 'Preview']]; }        // shell adds scheme + Esc/Tab hints
  handleInput(data: string) { /* raw keys only, e.g. matchesKey(data, 'z') */ }

  handleNavigation(action: NavigationAction) {
    if (action === 'confirm') return this.openPreview();
    if (action === 'step-forward') this.navigator.moveBy(1);
    // ...map step/page/first/last to the navigator; 'dismiss' never arrives here
  }

  private openPreview() {
    this.context?.pushLayer(new PreviewLayer(theme, {
      title: () => this.theme.fg('accent', this.theme.bold(row.label)),
      meta: () => this.theme.fg('muted', `${row.tokens} tokens`),
      body: width => wrapMyText(width),             // you wrap; layer windows + counts
      description: width => [],                     // optional pinned lines below body
    }));
  }

  render(width: number, height: number | undefined): string[] {
    // height is the EXACT content region when the dialog is bounded ('half');
    // pad/truncate to fill it (shell also pads defensively). undefined = natural height.
  }
  invalidate() { this.cache.clear(); }              // shell calls this on theme change
}
```

`PreviewLayer` handles scrolling, the `(12/87)` overflow counter, and Esc-pops-itself. It reacts to navigation actions; raw keys are ignored.

### Inline or centered overlay

Use the host-facing presenter when the modal's semantic layout is configurable. It keeps the renderer frame and host mounting options synchronized:

```ts
import { ModalDialog, presentModal } from './libs/modal/index.js';

await presentModal(ctx.ui, layout, (tui, theme, keybindings, done, frame) =>
  new ModalDialog(tui, theme, keybindings, {
    frame,
    // ...tabs, height, cancelValue, onComplete: done
  }),
);
```

`layout` is `'inline'` or `'overlay'`. Overlay uses the bordered frame and a centered 85%-width host overlay with one-cell margin; inline uses the normal custom-UI flow and inline rules.

## Behavior contract (what users can rely on)

- **Esc/q** closes the top preview layer first, then the dialog (`onComplete(cancelValue)`).
- **Tab / Shift+Tab** cycles tabs even while a preview is open; every tab keeps its selection, scroll, zoom, and open layers.
- **Tab labels are live** — return counts from a closure and the strip updates on the next render.
- **`gg` chords never leak** across tab switches or layer push/pop (shell calls `scheme.reset()`).
- **Filter + Vim don't mix** — a modal gets a text filter **or** a command-style scheme, never both (`j` can't mean "down" and "j"). No insert/normal modes; don't build one.
- **Height 'half'** bounds the whole dialog to `floor(terminal.rows / 2)` lines including frame; tabs must render exactly the `height` they're given.

## API reference

### `presentModal<TResult>`

`presentModal(ui, layout, factory)` mounts a modal through Pi's custom-UI API. The factory receives the resolved `ModalFrame` (`'inline'` or `'bordered'`); the helper supplies the matching host overlay options for `'overlay'` and no overlay options for `'inline'`.

### `ModalDialog<TResult>` options

| Option | Type | Default | Purpose |
| --- | --- | --- | --- |
| `tabs` | `ModalTab[]` | required | ≥1 tab; first is active unless `initialTabIndex` |
| `navigation` | `NavigationScheme` | `PiKeybindingsScheme` | key→action mapping |
| `frame` | `'inline' \| 'bordered'` | `'inline'` | rules vs rounded border |
| `height` | `'auto' \| 'half'` | `'auto'` | bound to half terminal |
| `title` | `string \| () => string` | — | line above the tab strip |
| `notices` | `string[] \| () => string[]` | — | `⚠` warning lines below the strip |
| `maxNoticeLines` | `number` | unlimited | overflow summary line |
| `filter` | `{ initialQuery? }` | — | shared text input; calls `tab.applyFilter` |
| `cancelValue` / `onComplete` | `TResult` / callback | required | dismissal result + sink |

Methods: `complete(result)`, `handleInput(data)`, `render(width)`, `invalidate()`, `focused`, `activeTab`, `activeIndex`.

### `ListTab<T>` options

`label` (string or `(counts) => string`), `items`, `renderRow(item, selected, width)`, `onConfirm(item)` are required. Optional: `filterText`, `filterCaption`, `footer(state)`, `emptyMessage`, `noMatchMessage`, `wrap` (default clamp), `visibleCount`, `initialIndex`, `hints`.

### Building blocks for custom tabs

`ListNavigator` (selection + scroll window; `wrap` option; `setRowCount` for filtered lists) · `PreviewScroller` · `PreviewLayer` · `RenderCache` (`read`/`write`/`clear` keyed on width+height) · text helpers `fitLine`, `spreadLine`, `padLine`, `singleLine`, `hintRow`, `wrapDescriptionLines`, `calculateViewport`, `fitToTerminalHeight`, `BODY_INDENT`.

### `NavigationAction`

`'step-back' | 'step-forward' | 'page-back' | 'page-forward' | 'first' | 'last' | 'confirm' | 'dismiss'` — tabs/layers never receive `'dismiss'`; the shell owns it.

## Testing your modal

Construct with stub host objects and drive `handleInput` with raw keys — no terminal needed. See `test/modal/modal-dialog.test.ts` for the pattern (identity `theme`, `{ terminal: { rows: 24 }, requestRender() {} }` TUI, a `matches()` stub for `KeybindingsManager`).

## In-repo examples

- `src/extensions/model-select/model-select-dialog.ts` — filterable multi-tab picker, both frames.
- `src/extensions/context-view/ui/context-view-dialog.ts` + `usage-view.ts` / `injections-view.ts` — Vim inspector, half-height, custom tabs, preview layers.
