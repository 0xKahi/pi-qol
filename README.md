# pi-qol

> Quality-of-life extensions for [pi](https://github.com/earendil-works/pi).

A small collection of opt-in extensions that smooth out everyday pi usage. Today
it ships **`auto_session_name`** — automatic, opencode-style session titling — and
**`model_select`** — an interactive model picker.

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

Adds `/select-model`, an interactive model picker with fuzzy search, optional favourites,
provider filtering, and inline or overlay layouts,

- **quick access** to listed favourite models
- **filtering** specified providers from model search 

allow keybindings with [pi-vim-keys](https://github.com/0xKahi/pi-vim-keys) with eventId of `pi.vimKeys.event:pi-qol.model_select`


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
    "provider_filter": ["anthropic", "openai"],
    "favourite": [{ "provider": "anthropic", "modelId": "claude-sonnet-4-5" }]
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

| Key               | Type      | Default  | Description                                               |
| ----------------- | --------- | -------- | --------------------------------------------------------- |
| `enabled`         | `boolean` | `false`  | Turn the model picker on.                                 |
| `layout`          | `enum`    | `inline` | Picker layout: `inline` or `overlay`.                     |
| `provider_filter` | `string[]`| `[]`     | Restrict searchable models to these providers.            |
| `favourite`       | `object[]`| `[]`     | Favourite models shown in a separate tab (`provider`, `modelId`). |

Project config shallow-merges each top-level section over global config. If project
config sets `model_select.favourite`, it replaces the global favourites array.

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
scripts/                         # JSON schema generation
assets/config.schema.json        # generated config schema
```

## License

See repository for license details.

## Author

[0xKahi](https://github.com/0xKahi)
