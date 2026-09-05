# pi-qol

> Quality-of-life extensions for [pi](https://github.com/earendil-works/pi).

A small collection of opt-in extensions that smooth out everyday pi usage. Today
it ships **`auto_session_name`** — automatic, opencode-style session titling,
**`model_select`** — an interactive model picker, and **`custom_footer`** — a
compact configurable interactive footer.

## Installation

Install the package from npm:

```bash
pi install npm:@0xkahi/pi-qol
```

Then register it in your pi configuration so pi loads `./src/index.ts` as an
extension (see the `pi.extensions` field in `package.json`).

## Features

### `auto_session_name`

Automatically generates a short, human-readable title for a brand-new session from
its first user message, using a cheap model call that runs in the background and
never blocks your turn.

- **Non-blocking** — titles are generated asynchronously while the agent responds.
- **Fires once, early** — only on the very first real user turn of a session.
- **Smart guards** — skips sessions that already have a name, forked/child
  sessions, and empty prompts.
- **Model-flexible** — use a configured cheap model, or fall back to the active
  session model automatically.
- **Safe output** — strips `<think>` blocks, unwraps quotes, and truncates titles
  to 100 characters.

### `model_select`

Adds `/select-model`, an interactive model picker with fuzzy search, permanent
Favourites, ordered custom group tabs, provider filtering, and inline or overlay layouts.

- **quick access** to listed favourite models and user-defined favourite subsets
- **shared filtering** across Favourites, group, and Search tabs
- **bidirectional tab navigation** with Tab and Shift+Tab
- **provider filtering** for Search without removing models from favourite tabs

allow keybindings with [pi-vim-keys](https://github.com/0xKahi/pi-vim-keys) with eventId of `pi.vimKeys.event:pi-qol.model_select`

### `custom_footer`

Replaces pi's built-in interactive footer with the same three-line layout, but
shows the current directory as an icon plus basename, supports hex color overrides,
can hide token/cache clusters, and adds an OAuth subscription-usage progress bar
for supported providers (Anthropic and OpenAI Codex).

- **Directory line** — optional inverse-styled agent badge followed by the
  directory icon + basename, with optional git branch and session name. The badge
  is disabled by default.
- **Stats line** — cumulative input/output tokens, cache read/write/hit cluster,
  session cost (or `(sub)` when on a subscription), context-window usage, and the
  right-aligned model name (with provider prefix when multiple providers are
  available).
- **Subscription usage** — a colored progress bar plus percentage and reset time
  for the active OAuth provider. Usage is fetched lazily and cached, refreshing
  at most once every 60 seconds per provider; auth/network failures simply hide
  the segment.

Known difference from pi's built-in footer: the `(auto)` compaction suffix is
omitted because extensions do not expose reliable live state for it.

## Configuration

`pi-qol` reads a JSON config file named `config.json` from two locations and merges
them (project overrides global):

| Scope   | Path                                                       |
| ------- | ---------------------------------------------------------- |
| Global  | `<agent-dir>/extensions/pi-qol/config.json`                |
| Project | `<cwd>/.pi/extensions/pi-qol/config.json` (trusted projects only) |


> Project config is only loaded when the project is trusted.

### Example

```json
{
  "$schema": "https://raw.githubusercontent.com/0xKahi/pi-qol/main/assets/config.schema.json",
  "auto_session_name": {
    "enabled": true,
    "model": {
      "provider": "opencode",
      "modelId": "gpt-5-nano",
      "reasoning": "low"
    }
  },
  "model_select": {
    "enabled": true,
    "layout": "overlay",
    "favourite_label": "Pinned",
    "provider_filter": ["anthropic", "openai"],
    "groups": ["work", "fast"],
    "favourite": [
      {
        "provider": "anthropic",
        "modelId": "claude-sonnet-4-5",
        "groups": ["work", "fast"]
      }
    ],
    "hide_tabs": { "groups": false, "search": false }
  },
  "context_view": {
    "enabled": true,
    "layout": "inline"
  },
  "custom_footer": {
    "enabled": true,
    "colors": {
      "directory": "#A78BFA",
      "modelName": "#60A5FA",
      "agentName": "#FBBF24"
    },
    "display": {
      "tokens": true,
      "cache": true,
      "agentName": true
    },
    "defaultAgentName": "DEFAULT"
  }
}
```

### Options

#### `auto_session_name`

| Key       | Type      | Default | Description                                                        |
| --------- | --------- | ------- | ------------------------------------------------------------------ |
| `enabled` | `boolean` | `false` | Turn the auto session naming feature on.                           |
| `model`   | `object`  | —       | Optional model used to generate titles. Falls back to the session model if omitted. |


#### `model`

| Key         | Type     | Description                                                            |
| ----------- | -------- | --------------------------------------------------------------------- |
| `provider`  | `string` | Model provider id (e.g. `anthropic`, `openai`).                       |
| `modelId`   | `string` | Model identifier as registered in pi's model registry.               |
| `reasoning` | `enum`   | One of `off`, `minimal`, `low`, `medium`, `high`, `xhigh`.            |


When `model` is set but cannot be found or authenticated, `pi-qol` automatically
falls back to the active session model and surfaces a warning notification.

#### `model_select`

| Key                    | Type       | Default  | Description                                               |
| ---------------------- | ---------- | -------- | --------------------------------------------------------- |
| `enabled`              | `boolean`  | `false`  | Turn the model picker on.                                 |
| `layout`               | `enum`     | `inline` | Picker layout: `inline` or `overlay`.                     |
| `favourite_label`      | `string`   | `Favourites` | Non-empty label for the permanent first tab.          |
| `provider_filter`      | `string[]` | `[]`     | Restrict Search models to these providers; favourite tabs are unaffected. |
| `groups`               | `string[]` | `[]`     | Ordered custom group tabs. Exact duplicate names use their first occurrence. |
| `favourite`            | `object[]` | `[]`     | Favourite models (`provider`, `modelId`, optional `groups`). |
| `favourite[].groups`   | `string[]` | `[]`     | Exact, case-sensitive group memberships for a favourite. Unknown names are ignored. |
| `hide_tabs.groups`     | `boolean`  | `false`  | Hide all custom group tabs.                               |
| `hide_tabs.search`     | `boolean`  | `false`  | Hide the Search tab. Favourites cannot be hidden.         |

The favourites tab is always first, even when empty, and uses `favourite_label`
as its display label. Unique groups follow in configured order, and Search is
last when visible. Use Tab to cycle forward and Shift+Tab to cycle backward
through visible tabs. A favourite can belong to multiple groups; group tabs
contain only resolved, authenticated favourites and preserve favourite order.
Duplicate favourite declarations remain first-entry-wins.

#### `context_view`

| Key       | Type      | Default | Description |
| --------- | --------- | ------- | ----------- |
| `enabled` | `boolean` | `false` | Enable the Context View capture and interface. |
| `layout`  | `enum`    | `inline` | Context View presentation: `inline` or centered `overlay`. |

### Context View

Context View is a fork of Dmitry Makarov's [pi-context-view](https://github.com/dimk90/pi-context-view), adapted into one unified tabbed interface with Vim-friendly keybindings. Enable it, then run `/context-view` with no arguments. The Usage tab opens first; Tab and Shift+Tab switch between Usage and Injections. Use `j`/`k` or arrows to move, `Ctrl+u`/`Ctrl+d` to move by a page, `gg`/`G` to jump to the beginning/end, Enter to preview, and Esc or `q` to return or close. By default it opens inline; set `context_view.layout` to `overlay` for a centered overlay. Other extensions can open the same view by emitting `pi.vimKeys.event:pi-qol.context_view`.

#### `custom_footer`

| Key                         | Type      | Default   | Description                                      |
| --------------------------- | --------- | --------- | ------------------------------------------------ |
| `enabled`                   | `boolean` | `false`   | Replace pi's built-in interactive footer.        |
| `display.tokens`            | `boolean` | `true`    | Show cumulative input/output token counts.       |
| `display.cache`             | `boolean` | `true`    | Show the custom cache read/write/hit cluster.    |
| `display.agentName`         | `boolean` | `false`   | Prefix the first line with a padded bold inverse agent badge. |
| `defaultAgentName`          | `string`  | `DEFAULT` | Agent name restored at the start of each session. |
| `colors.directory`          | `hex`     | —         | Color the directory icon and basename.           |
| `colors.modelName`          | `hex`     | —         | Color the right-aligned model name.              |
| `colors.agentName`          | `hex`     | —         | Agent badge foreground color before inversion.   |
| `colors.anthropicUsage`     | `hex`     | `#D97706` | Color the Claude subscription usage segment (bar + percentage). |
| `colors.codexUsage`         | `hex`     | `#10B981` | Color the Codex subscription usage segment (bar + percentage).  |
| `icons.directory`           | `string`  | nerd font | Glyph shown before the directory basename.       |
| `icons.cache`               | `string`  | nerd font | Glyph for the cache cluster.                     |
| `icons.cacheRead`           | `string`  | nerd font | Glyph for cache-read tokens.                     |
| `icons.cacheWrite`          | `string`  | nerd font | Glyph for cache-write tokens.                    |
| `icons.refresh`             | `string`  | nerd font | Glyph shown before the subscription reset time.  |

When enabled, the badge has no brackets, uses bold and inverse styling, and adds
one styled padding space on each side of the name. One normal, unstyled space
separates the trailing badge padding from the directory. Names are trimmed and
sanitized. Names wider than ten terminal columns are rendered as their first ten
visible columns plus `...`; badge padding does not count toward that limit, and
wide Unicode characters are never split. Badge color precedence is a valid event
color,
`colors.agentName`, then pi's `accent` theme color. Event-selected names and
colors are session-scoped: every `session_start` restores `defaultAgentName` and
clears the event color.

Other extensions can update the current identity through pi's event bus:

```ts
pi.events.emit('pi.qol.event:set-agent-name', {
  agentName: 'Reviewer',
  color: '#FFFFFF', // optional; must be #RRGGBB
});
```

Invalid or empty names are ignored. A missing or invalid event color clears any
previous event color and uses the normal fallback precedence.

Project config shallow-merges each top-level section over global config. Arrays
replace lower-precedence arrays, so project `model_select.favourite` or
`model_select.groups` replaces the corresponding global array. Nested objects are
also replaced as values during that section merge; for example, a project
`hide_tabs` object replaces the global one, then omitted `groups` or `search`
fields receive their default of `false`.

## How it works

On `before_agent_start`, the `auto_session_name` extension checks a series of
guards before doing any work. It only proceeds when **all** of the following hold:

1. The feature is enabled in config.
2. The session does not already have a name.
3. The session is not a fork/child session.
4. It is the user's first turn.
5. The user prompt is non-empty.

If those pass, it resolves a model, generates a title via a dedicated
title-generation prompt, cleans the result, and persists it with
`pi.setSessionName()`. The work runs in a cancellable background task that is
aborted on session shutdown.

## Development

This project uses [Bun](https://bun.sh) and [Biome](https://biomejs.dev).

```bash
bun install        # install dependencies
bun run check      # biome fix + type-check
bun test           # run tests
bun run buildSchema # regenerate assets/config.schema.json from the zod schemas
```

### Project structure

```
src/
  index.ts                       # extension entry — lifecycle wiring only
  config-loader.ts               # loads + merges global/project config
  constants.ts                   # EXTENSION_ID
  schemas/                       # zod config schemas (full + partial)
  utils/                         # path + model-resolution helpers
  extensions/
    auto-session-name/           # the auto_session_name feature
    model-select/                # the model_select feature
    custom-footer/               # the custom_footer feature
scripts/                         # JSON schema generation
assets/config.schema.json        # generated config schema
```

## License

See repository for license details.

## Author

[0xKahi](https://github.com/0xKahi)
