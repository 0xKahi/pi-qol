## Context

See `proposal.md` for motivation and `specs/context-view/spec.md` for the behavior contract. The source plugin is an MIT-licensed Pi extension of roughly 3,600 source lines. It combines event registration, initial-context capture, a synthetic probe, usage classification, and two independent fullscreen views. pi-qol instead registers feature modules through `src/index.ts`, reads typed feature configuration through one `ConfigLoader`, and uses a command-plus-event controller pattern in model-select.

A key constraint is that slash-command handlers receive `ExtensionCommandContext`, while `pi.events` listeners only have a cached ordinary `ExtensionContext`. The fork therefore cannot require command-only APIs in the shared UI-opening path. Context View also handles sensitive system prompts, tool schemas, context files, skills, and messages; raw captured content must remain process-local.

## Goals / Non-Goals

**Goals:**
- Preserve the upstream capture, measurement, classification, map, hierarchy, preview, degraded-fallback, and probe-filtering behavior while adapting it to pi-qol conventions.
- Give slash-command and Vim-event activation one shared controller path.
- Make Usage and Injections stateful child views of one tabbed inline interface.
- Keep domain transformations and navigation models independently testable.
- Ensure disabled Context View has no capture or probe side effects.

**Non-Goals:**
- Add runtime injection history beyond the upstream initial snapshot.
- Make token estimates provider-exact when Pi or the provider does not report a breakdown.
- Add configurable tab order, keybindings, layout, colors, or map dimensions in this change.
- Expose captured raw context through headless output, logs, autocomplete, or persisted session data.
- Preserve the upstream `/context`, `/context usage`, or `/context injections` command grammar.

## Decisions

### 1. Use pi-qol registration with a feature-scoped coordinator

`registerContextView(pi, { config })` will be called from the root extension entry point. It will own a feature-scoped capture coordinator and register the Pi lifecycle hooks needed by the upstream behavior. Every lifecycle handler will check `config.isEnabled('context_view')` before observing or changing state. Command and event activation will be installed lazily on the first enabled `session_start`, matching model-select's registration pattern.

The coordinator will separate:
- session and probe state,
- capture and measurement,
- view-data construction,
- command/event orchestration,
- UI rendering.

Alternative considered: copy the upstream default extension factory into pi-qol and call it from `src/index.ts`. This was rejected because it bypasses shared configuration, leaves orchestration mixed with capture behavior, and makes the unified tabbed UI harder to reason about.

### 2. Mirror model-select's latest-context event bridge

The controller will cache the latest `ExtensionContext` on `session_start`, register `/context-view`, and subscribe to `pi.vimKeys.event:pi-qol.context_view`. The event listener will return silently if no context exists or the feature is disabled; otherwise it will invoke the same opening function as the slash command and report asynchronous opening failures through the cached UI, following model-select's pattern.

The opening function will accept ordinary `ExtensionContext`. Command-only conveniences such as `waitForIdle()` will be used conditionally when present, as model-select does, rather than becoming prerequisites for event activation.

Alternative considered: send `/context-view` as an injected user message from the Vim event. This was rejected because it risks entering the model conversation and does not provide a reliable command-dispatch contract.

### 3. Retain owned structured prompt inputs in lifecycle state

The upstream implementation reads current structured prompt options from the command context when constructing Usage. To support event invocation, the coordinator will retain owned copies of the latest `before_agent_start.systemPromptOptions` independently of the capture-once initial snapshot. A silent probe populates these options when no real turn has occurred. Current Usage construction can then combine the ordinary context's current system prompt, the retained structured inputs, active tool metadata, and current session branch.

When no complete structured snapshot can be obtained, the existing Pi-native degraded fallback remains available and is visibly identified. Raw prompt and message content will never be persisted; only synthetic probe role/timestamp identities may be appended for later filtering.

Alternative considered: cast cached `ExtensionContext` to `ExtensionCommandContext`. This was rejected as unsafe because the Pi API explicitly limits those methods to command handlers.

### 4. One parent dialog owns tabs and global input precedence

A `ContextViewDialog` will create and retain one Usage child view and one Injections child view for the lifetime of the inline interface. The parent will:
- start on Usage,
- intercept `Tab` and `Shift+Tab` before delegation,
- switch active children without reconstructing them,
- delegate all other input and rendering to the active child,
- request rendering after handled input.

This preserves selection, viewport, preview, map zoom, and scroll state naturally. Tab switching remains available from previews because it is handled before child input. The common shell will render the Context View title, active tab styling, global help, and shared inline borders; child views will render their tab-specific metadata and body rather than duplicate independent overlay shells.

Alternative considered: close one upstream `ui.custom()` view and open the other on Tab. This was rejected because it loses state, complicates focus/lifecycle behavior, and can flicker.

### 5. Centralize Vim sequence and navigation semantics

Shared input helpers will define:
- `j`/`k` and Down/Up as one-step movement,
- `Ctrl+d`/`Ctrl+u` as one-page movement,
- `gg`/`G` as first/last movement,
- Enter as preview,
- Esc/q as child back or parent close.

The parent/input router will track a pending lowercase `g`; a second consecutive lowercase `g` emits the start action, while any other input clears the pending sequence before normal handling. `G` emits the end action directly. PageUp/PageDown/Home/End will not be mapped. Hints will describe only active bindings.

Navigation actions will be semantic inputs consumed by both list navigation and preview scrolling so key interpretation is not duplicated across Usage and Injections.

Alternative considered: use Pi's configurable selection keybinding IDs for all movement. This was rejected because this change intentionally defines a Vim-oriented modal interface, including multi-key `gg`, that does not correspond to existing Pi keybinding actions.

### 6. Preserve upstream domain behavior as pure modules

Measurement, semantic models, usage classification, proportional-map calculation, injection-row construction, preview text handling, and viewport math will remain pure or side-effect-free modules. Runtime Pi access will stay in registration, capture, and controller code. UI child modules may depend on domain models and shared navigation/layout helpers but will not query Pi directly.

The expected feature structure is:

```text
src/extensions/context-view/
├── index.ts
├── constants.ts
├── context-view-controller.ts
├── capture.ts
├── measure.ts
├── model.ts
├── usage.ts
└── ui/
    ├── context-view-dialog.ts
    ├── usage-tab.ts
    ├── injections-tab.ts
    ├── navigation.ts
    ├── layout.ts
    ├── usage-map.ts
    └── skill-preview.ts
```

Exact helper boundaries may shift during migration if tests show a clearer cohesion boundary, but lifecycle/controller/domain/UI separation must remain.

### 7. Integrate configuration through the schema-first pipeline

A dedicated context-view schema will define only `enabled`, defaulting to false, plus a partial override form. Top-level full and partial schemas, `ConfigLoader`, extension ID typing, root registration, generated JSON Schema, and schema tests will be updated consistently. No context-view runtime object will read config files directly.

Alternative considered: an independent upstream configuration file. This was rejected because all pi-qol features share global/project precedence and trust handling through `ConfigLoader`.

### 8. Preserve provenance in user-facing documentation

The README will credit Dmitry Makarov, link `https://github.com/dimk90/pi-context-view`, state that pi-qol Context View is a fork, and document the unified tabs, Vim controls, configuration, command, and Vim event ID. Imported source should retain appropriate upstream provenance comments where useful, while formatting and organization follow pi-qol conventions.

## Risks / Trade-offs

- **[Silent probes interact with Pi's agent lifecycle]** → Preserve the upstream single-attempt state machine, abort the probe turn at `turn_start`, sanitize its assistant result, persist only exact identities, and retain focused lifecycle tests.
- **[Event invocation lacks command-only idle and prompt-option APIs]** → Use conditional idle waiting and lifecycle-owned prompt-option snapshots; degrade visibly instead of unsafe casting or persistence.
- **[Modified control keys can vary under terminal protocols]** → Match `Ctrl+d`/`Ctrl+u` explicitly with the TUI key matcher and add direct input tests using representative raw sequences.
- **[A pending `g` sequence can swallow an otherwise unused key]** → Limit sequence state to lowercase `g`, clear it on every non-`g` input and tab switch, and test interrupted sequences.
- **[Fullscreen shared chrome reduces child viewport height]** → Recalculate fixed-line budgets after introducing tabs and test narrow/short terminal rendering bounds.
- **[Forked upstream logic may diverge from future upstream fixes]** → Keep imported domain concepts recognizable, document the source commit used during implementation, and maintain behavior-focused tests so future updates can be compared selectively.
- **[Captured content is sensitive]** → Keep it in memory, avoid logs and serialized details, and persist only role/timestamp probe identities.

## Migration Plan

1. Add the disabled-by-default schema and root registration without enabling it for existing users.
2. Import and reorganize upstream pure domain/capture behavior with its tests.
3. Introduce the parent tabbed dialog and Vim navigation adaptations.
4. Add command and event activation plus README attribution and usage documentation.
5. Regenerate the JSON Schema and run unit, type, lint, and formatting checks.

Rollback consists of removing the new registration, schema section, feature directory, tests, generated-schema section, and documentation. Existing configurations remain unaffected because the feature defaults to disabled.
