## Context

See `proposal.md` for motivation. Today `ModalDialog` renders either an inline or bordered frame, but the semantic layout is split across layers: each consumer maps its layout to a frame inside the component and separately passes overlay options to `ExtensionUIContext.custom()` at the opening call site. Model Select implements both halves; Context View always uses the default inline frame and mounts inline with a half-terminal height policy.

The shared modal directory must remain copy-portable and may import only Pi host packages or its own modules. Pi requires overlay placement to be selected when `ui.custom()` is called, so a rendered component cannot turn itself into an overlay after mounting.

## Goals / Non-Goals

**Goals:**

- Give modal consumers one semantic layout choice that cannot drift between frame rendering and host mounting.
- Preserve Model Select's current centered 85%-width overlay with one-cell margin.
- Let Context View use either presentation while preserving its independent half-height policy.
- Keep host presentation lifecycle outside `ModalDialog` itself and preserve the modal library's self-containment.

**Non-Goals:**

- Generalize arbitrary overlay anchors, dimensions, or margins in this change.
- Change modal navigation, tab state, filtering, previews, or completion behavior.
- Make Context View fullscreen or alter its height bound based on layout.

## Decisions

### Add a host-facing modal presenter alongside the renderer

Add a generic shared presenter (for example, `presentModal`) under `src/libs/modal/`. It accepts an `ExtensionUIContext`, a semantic `ModalLayout` (`inline | overlay`), and a component factory. The presenter invokes `ui.custom()` and supplies the factory with the resolved `ModalFrame`:

- `inline` resolves to `frame: 'inline'` and no custom-UI overlay options.
- `overlay` resolves to `frame: 'bordered'` and host options `{ overlay: true, overlayOptions: { anchor: 'center', width: '85%', margin: 1 } }`.

The factory still constructs the concrete dialog and owns feature-specific inputs, result handling, and height policy. The presenter owns only the coordinated presentation choice.

This is preferred over adding `layout` to `ModalDialog`, because `ModalDialog` cannot control how the host mounted it. It is also preferred over exporting a passive `{ frame, customOptions }` resolver because that would still allow consumers to use only one half and recreate mismatched combinations.

### Keep frame as the renderer-level primitive

`ModalDialog` retains `frame: ModalFrame`; it does not accept an `ExtensionUIContext` or invoke host UI lifecycle methods. This keeps direct component construction simple for tests and supports advanced consumers that are mounted by other host mechanisms.

The presenter callback receives the resolved frame, and `ModelSelectDialog` and `ContextViewDialog` pass that frame into their `ModalDialog` options. Feature dialog types no longer need to infer frame from semantic layout.

### Configure Context View layout in its existing feature schema

Extend the full and partial Context View Zod schemas with `layout: z.enum(['inline', 'overlay'])`, defaulting to `inline`. The opening flow reads the loaded `context_view` configuration and calls the shared presenter for both slash-command and event activation paths. The dialog keeps `height: 'half'` regardless of the supplied frame.

Using the same string values and default as Model Select maintains configuration consistency. A shared schema type is not introduced because the feature schemas are intentionally independent and the two-field enum is not sufficient reason to couple them.

### Preserve one shared overlay policy

Both consumers use the presenter's centered, 85%-width, one-cell-margin overlay policy. These values exactly preserve Model Select's current behavior and define Context View's new overlay presentation. Per-consumer overrides remain out of scope until a concrete differing requirement exists.

## Risks / Trade-offs

- [The presenter couples the portable library to Pi's extension UI API] → It imports only the allowed Pi host type and formalizes integration already required at every consumer; `ModalDialog` remains independently renderable.
- [A fixed overlay policy may not suit future dialogs] → Keep the initial API narrow and add explicit overrides only when a real use case requires them.
- [Half-height accounting may look different inside a centered overlay] → Retain the existing terminal-based bound and add tests asserting that the height policy remains active with a bordered frame.
- [Migrating Model Select could accidentally change behavior] → Assert presenter options and retain existing dialog/render tests for both layouts.

## Migration Plan

1. Add and test the shared presenter and export its public types/functions.
2. Migrate Model Select to the presenter while preserving existing layout output and overlay options.
3. Add Context View schema/config support and route both activation paths through the presenter.
4. Update tests, documentation, generated schema, and codemaps.

Rollback is straightforward: restore each consumer's direct `ui.custom()` call and remove the optional Context View layout setting; existing configurations remain compatible because `inline` is the default.
