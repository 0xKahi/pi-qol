# Plan: `auto_session_name` extension

> Implements automatic, opencode-style session titling for `pi-qol`.
> When a brand-new session receives its first real user message, an ephemeral
> cheap-model call generates a short, human-readable session name and persists
> it via `pi.setSessionName()` — in the background, never blocking the turn.

This document is written for an implementing agent. Read it top to bottom before
writing code. It assumes the conventions used in
`/Users/kahi/Desktop/code/plugins/pi/pi-vim-keys/` (the reference extension).

---

## 0. Context you must internalize first

### 0.1 Reference patterns (from `pi-vim-keys`)
- **`src/index.ts`** is a thin default-export factory `(pi: ExtensionAPI) => void`.
  It owns lifecycle wiring only (`pi.on('session_start', ...)`, `session_shutdown`)
  and delegates real work to classes/modules.
- **`src/config-loader.ts`** = a `ConfigLoader` class that:
  - holds an in-memory typed config (`this.config`),
  - exposes `defaultConfig` via `Schema.parse({})`,
  - `initializeConfig(ctx)` merges global (`getAgentDir()`) then project
    (`ctx.cwd/.pi`) config files, returning `{ success, error? }`,
  - reads JSON files with `PartialConfigSchema.safeParse`, prettifies errors with
    `z.prettifyError`.
- **`src/utils/path.util.ts`** = `PathUtil` static class that resolves config file
  locations: `.../extensions/<EXTENSION_ID>/config.json` for both `global`
  (`getAgentDir()`) and `project` (`cwd/.pi`).
- **`src/constants.ts`** holds `EXTENSION_ID` and tunables.
- **`src/schemas/*.schema.ts`** = zod schemas; full + `Partial` variants.
- **`scripts/build-schema*.ts`** generate `assets/config.schema.json` from the zod
  schema (already wired in `pi-qol`).
- Code style: zod v4, single quotes, `arrowParentheses: asNeeded`, lineWidth 150,
  `organizeImports`. Run `bun run check` (biome fix + tsc) before finishing.

### 0.2 Current `pi-qol` state (already created — do NOT recreate)
- `src/schemas/shared-config.schema.ts` — `ReasoningLevelSchema`, `ModelConfigschema`
  (`{ provider, modelId, reasoning }`).
- `src/schemas/auto-session-name.config.schema.ts` — `AutoSessionNameConfigSchema`
  is a discriminated-ish union: when `enabled: true`, `model` is **required**;
  when `enabled: false`, `model` is optional.
- `src/schemas/config.schema.ts` — `ConfigSchema` / `PartialConfigSchema` with
  `auto_session_name` (defaults to `{ enabled: false }`).
- `src/constants.ts` — `EXTENSION_ID = 'pi-qol'`.
- `src/index.ts` — **empty**, must be authored.
- `src/config-loader.ts` — **empty**, must be authored.
- `src/extensions/auto-session-name/index.ts` — **empty**, must be authored.
- `scripts/build-schema*.ts` — done; just re-run after schema edits.

### 0.3 Key pi SDK facts (verified against `node_modules/@earendil-works/*`)
- Extension factory: `export default function (pi: ExtensionAPI) {}`.
- `pi.setSessionName(name: string)` — persists the display name. (`pi.getSessionName()`
  returns `string | undefined`.) This is our `setTitle` equivalent.
- `ctx.sessionManager` (`ReadonlySessionManager`) — `getBranch()` / `getEntries()`
  return `SessionEntry[]`. Message entries are `{ type: 'message', message: AgentMessage }`
  where `message.role` is `'user' | 'assistant' | 'toolResult'`.
- `ctx.model: Model<any> | undefined` — the active session model.
- `ctx.modelRegistry: ModelRegistry`:
  - `.find(provider, modelId): Model | undefined`
  - `.getApiKeyAndHeaders(model): Promise<{ ok: true; apiKey?; headers? } | { ok: false; error }>`
  - `.getAvailable(): Model[]`
- `ctx.signal: AbortSignal | undefined` — present during a turn.
- Ephemeral model call (no agent, no tools) via `@earendil-works/pi-ai`:
  ```ts
  import { complete } from '@earendil-works/pi-ai';
  const msg = await complete(model, context, options); // returns AssistantMessage
  ```
  - `context: { systemPrompt?: string; messages: Message[]; tools?: Tool[] }`
  - `Message` user shape: `{ role: 'user', content: string, timestamp: number }`
  - `options: ProviderStreamOptions` (`{ apiKey?, headers?, maxRetries?, signal?, maxTokens?, temperature? }`)
  - Result text: `msg.content.filter(c => c.type === 'text').map(c => c.text).join('')`.
  - Omitting `tools` ⇒ titling cannot call tools (spec requirement satisfied).
- Relevant event: **`before_agent_start`** — fires after user submits, before the
  agent loop. `event.prompt` is the raw user prompt text (post-expansion). This is
  the cleanest source for the "first real user message" content and the cleanest
  trigger point. (`agent_start` is an alternative but lacks the prompt text.)

### 0.4 Mapping the spec (`.pi/private/auto-session-rename.md`) to pi
| Spec concept | pi equivalent |
|---|---|
| `session.title` mutable + default placeholder | `pi.getSessionName()` — `undefined` when unset = "default" |
| `isDefaultTitle(title)` | `pi.getSessionName() === undefined` (no name yet) |
| `parentID` child-session skip | session header `parentSession` / `session_start` reason `'fork'` |
| "exactly one real user message" | count `role === 'user'` message entries in branch |
| synthetic-part filtering | filter custom/injected messages; user prompt from `before_agent_start` is real |
| `setTitle(id, title)` | `pi.setSessionName(title)` |
| background / fire-and-forget | call async titler **without `await`**, `.catch(log)` |
| cheap-model resolution | config model → fallback `ctx.model` |
| title system prompt | constant copied verbatim from spec §6 |
| output cleanup | strip `<think>`, first non-empty line, cap length |

---

## 1. Files to create

```
src/
  index.ts                              # (author) aggregator factory
  config-loader.ts                      # (author) shared multi-extension config loader
  constants.ts                          # (edit)   add nothing ext-specific; keep EXTENSION_ID
  utils/
    path.util.ts                        # (author) copy/adapt from pi-vim-keys
  extensions/
    auto-session-name/
      index.ts                          # (author) register hooks for this extension
      title-generator.ts                # (author) core orchestration (build → call → clean → persist)
      model-resolver.ts                 # (author) resolve Model + auth with fallback chain
      guards.ts                         # (author) first-turn / already-named / child-session checks
      prompt.ts                         # (author) TITLE_SYSTEM_PROMPT + buildTitleUserMessage()
      constants.ts                      # (author) MAX_TITLE_LENGTH, LEADING_PROMPT, MAX_RETRIES
test/
  auto-session-name/
    guards.test.ts                      # (author) unit tests for guards
    title-cleanup.test.ts               # (author) unit tests for output cleanup
```

> Keep each extension fully self-contained under `src/extensions/<name>/`. Shared
> infra (`config-loader.ts`, `utils/path.util.ts`, `schemas/`) lives at `src/` root.

---

## 2. Shared infrastructure

### 2.1 `src/utils/path.util.ts`
Copy the `pi-vim-keys` `PathUtil` almost verbatim. It already resolves
`.../extensions/<EXTENSION_ID>/config.json` for `global` and `project`. Only the
`EXTENSION_ID` import differs (already `'pi-qol'`). Rename the internal input type
to something generic (e.g. `FindConfigInput`).

### 2.2 `src/config-loader.ts` (multi-extension aware)
This is the central piece that makes "multiple extensions, one shared config, each
toggleable" work. Model it on the vim-keys `ConfigLoader`, but generalized:

```ts
export class ConfigLoader {
  private config: Config = this.defaultConfig;

  get defaultConfig(): Config {
    return ConfigSchema.parse({}); // applies auto_session_name default { enabled: false }
  }

  getConfig(): Config { return this.config; }

  // Per-extension enable check used by every extension's hooks.
  isEnabled(key: keyof Config): boolean {
    const section = this.config[key];
    return typeof section === 'object' && section !== null && 'enabled' in section
      ? Boolean((section as { enabled?: boolean }).enabled)
      : false;
  }

  getAutoSessionName() { return this.config.auto_session_name; }

  initializeConfig(ctx: ExtensionContext): { success: boolean; error?: string } {
    // 1. start from defaults
    // 2. merge global config (PathUtil.findExtensionConfig({ type: 'global' }))
    // 3. merge project config (PathUtil.findExtensionConfig({ type: 'project', cwd: ctx.cwd }))
    //    Only honor project config when ctx.isProjectTrusted() is true.
    // For each present file: read JSON, PartialConfigSchema.safeParse, on error
    // return { success:false, error: `${path}\n${z.prettifyError(error)}` }.
    // Merge strategy: shallow-merge top-level extension sections, then re-parse
    // through ConfigSchema so defaults + validation reapply.
  }
}
```

Notes:
- Merge per-extension sections object-by-object (like vim-keys merges `colors`/`keybinds`)
  so a project file can override just `auto_session_name` without dropping defaults.
- Re-`ConfigSchema.parse(merged)` at the end so the `enabled:true ⇒ model required`
  rule is enforced and produces a clear error if violated.
- Use `loadConfig(path)` private helper returning `PartialConfigSchema.safeParse(raw)`.

---

## 3. `src/index.ts` — aggregator factory

Responsibilities (lifecycle wiring only):
1. Instantiate one shared `ConfigLoader`.
2. On `session_start`: call `config.initializeConfig(ctx)`; if `error`, `ctx.ui.notify(error, 'error')`.
3. Register every extension's hooks, passing the shared `config` (and a logger).
   Each extension's `register()` installs its own `pi.on(...)` handlers and is
   responsible for checking `config.isEnabled('auto_session_name')` at event time
   (so `/reload` + config edits take effect without re-wiring).

```ts
import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import { ConfigLoader } from './config-loader';
import { registerAutoSessionName } from './extensions/auto-session-name';

export default function (pi: ExtensionAPI) {
  const config = new ConfigLoader();

  pi.on('session_start', (_event, ctx) => {
    const { error } = config.initializeConfig(ctx);
    if (error) ctx.ui.notify(error, 'error');
  });

  // Each extension wires its own pi.on handlers and self-guards on enabled.
  registerAutoSessionName(pi, { config });
}
```

> Design rule: `register*` functions are called once at factory time and install
> `pi.on` handlers. The enabled/disabled decision is made **inside** each handler
> by reading the live `config`, NOT at registration time — this keeps `/reload`
> and per-project toggling correct.

---

## 4. `src/extensions/auto-session-name/` — the extension

### 4.1 `constants.ts`
```ts
export const MAX_TITLE_LENGTH = 100;          // hard server-side cap (spec §5.4)
export const TITLE_MAX_TOKENS = 100;          // generation budget; titles are tiny
export const MAX_RETRIES = 2;                 // spec §3
export const LEADING_PROMPT = 'Generate a title for this conversation:\n';
```

### 4.2 `prompt.ts`
- Export `TITLE_SYSTEM_PROMPT` as a template string copied **verbatim** from
  `.pi/private/auto-session-rename.md` §6 (the full `<task>/<rules>/<examples>` block).
- Export `buildTitleUserMessage(userText: string): string`
  → returns `LEADING_PROMPT + userText`.
- (Optional) export `buildTitleContext(userText)` returning the full pi-ai
  `Context` `{ systemPrompt: TITLE_SYSTEM_PROMPT, messages: [{ role:'user', content, timestamp: Date.now() }] }`.
  Do **not** include `tools`.

### 4.3 `guards.ts`
Pure functions, unit-tested:
```ts
// "default title" check — pi has no name yet
export function isAlreadyNamed(pi: ExtensionAPI): boolean {
  return pi.getSessionName() !== undefined;
}

// child/forked session — skip
export function isChildSession(sessionStartReason: string | undefined, sessionManager): boolean;
//   true if the most recent session_start reason was 'fork', OR header.parentSession set.
//   Capture the reason in register() via the session_start event and pass it in.

// exactly-one-real-user-message: at before_agent_start the new prompt is NOT yet
// persisted, so the branch should contain ZERO prior user messages for the first turn.
export function isFirstUserTurn(sessionManager): boolean {
  const userMsgs = sessionManager.getBranch().filter(
    e => e.type === 'message' && e.message.role === 'user'
  );
  return userMsgs.length === 0;
}
```
> Verify the timing assumption during implementation: log `getBranch()` user-message
> count inside `before_agent_start` on a fresh session. If pi has already persisted
> the current user message by then, change the predicate to `=== 1`. Pick whichever
> makes "fires exactly once on the opening message" true. Document the chosen value.

### 4.4 `model-resolver.ts`
Implements the cheap-model fallback chain (spec §3):
```ts
export async function resolveTitleModel(ctx, configModel?: { provider; modelId; reasoning }) {
  // 1. configured model: ctx.modelRegistry.find(configModel.provider, configModel.modelId)
  // 2. fallback: ctx.model (current session model)
  // For the chosen model, call ctx.modelRegistry.getApiKeyAndHeaders(model).
  //   - if !ok → try the next candidate; if none resolve, return undefined.
  // Returns { model, apiKey?, headers? } | undefined.
}
```
Notes:
- pi has no first-class "small/fast model" registry concept, so the spec's
  middle tier collapses to: configured model → current model. (You MAY add a
  best-effort heuristic over `ctx.modelRegistry.getAvailable()` matching
  `/haiku|mini|flash|small/i` as an optional enhancement, but it is not required.)
- `reasoning` from config: keep titling cheap. Prefer reasoning off. Thinking level
  is provider-specific in pi-ai and not part of `complete()`'s core options, so it
  is acceptable to ignore `reasoning` in v1 and just not pass thinking options.
  Leave a `// TODO` if you want to wire reasoning later.

### 4.5 `title-generator.ts` — orchestration
```ts
export async function generateAndApplyTitle(deps: {
  pi: ExtensionAPI;
  ctx: ExtensionContext;
  userText: string;
  configModel?: ...;
  signal?: AbortSignal;
}): Promise<void> {
  // 1. resolve model+auth (model-resolver). If none → return (keep default).
  // 2. context = buildTitleContext(userText)
  // 3. const msg = await complete(model, context, {
  //      apiKey, headers, signal, maxRetries: MAX_RETRIES, maxTokens: TITLE_MAX_TOKENS,
  //    });
  // 4. const raw = extractText(msg);
  // 5. const title = cleanTitle(raw); if (!title) return;
  // 6. pi.setSessionName(title);
}

export function cleanTitle(raw: string): string {
  // a. strip <think>...</think> (and stray tags) — /<think>[\s\S]*?<\/think>/gi
  // b. split on /\r?\n/, trim each, take first non-empty line
  // c. if empty → return ''
  // d. strip surrounding quotes/backticks if the whole line is wrapped
  // e. hard cap: if length > MAX_TITLE_LENGTH → slice(0, MAX_TITLE_LENGTH - 1).trimEnd() + '…' (or '...')
  // return result
}
```
- `extractText(msg)` = `msg.content.filter(c => c.type === 'text').map(c => (c as TextContent).text).join('').trim()`.
- **All of this is wrapped so it never throws into the turn** (see §4.6).

### 4.6 `index.ts` — `registerAutoSessionName(pi, { config })`
```ts
export function registerAutoSessionName(pi: ExtensionAPI, deps: { config: ConfigLoader }) {
  let lastSessionStartReason: string | undefined;

  pi.on('session_start', (event, _ctx) => { lastSessionStartReason = event.reason; });

  pi.on('before_agent_start', (event, ctx) => {
    // self-guard: enabled?
    if (!deps.config.isEnabled('auto_session_name')) return;

    // guards (ALL must pass) — cheap synchronous checks first
    if (isAlreadyNamed(pi)) return;
    if (isChildSession(lastSessionStartReason, ctx.sessionManager)) return;
    if (!isFirstUserTurn(ctx.sessionManager)) return;

    const userText = event.prompt?.trim();
    if (!userText) return;

    const cfg = deps.config.getAutoSessionName();
    const configModel = cfg.enabled ? cfg.model : undefined;

    // FIRE-AND-FORGET — never await, never block the turn.
    void generateAndApplyTitle({
      pi, ctx, userText, configModel, signal: ctx.signal,
    }).catch(err => {
      // swallow & log only; a failed title must not break the turn
      // (use console.error or ctx.ui.notify at 'warn' behind a debug flag)
    });

    // return nothing — do NOT modify the prompt/systemPrompt
  });
}
```
> Important: `before_agent_start` may return `{ message, systemPrompt }` to modify
> the turn. We return `undefined` so the turn is untouched. The titling runs
> detached in the background.

---

## 5. The title system prompt (verbatim)

Copy the entire block from `.pi/private/auto-session-rename.md` §6 into
`prompt.ts` as `TITLE_SYSTEM_PROMPT`. Do not paraphrase. It includes `<task>`,
`<rules>`, and `<examples>`. The leading user message is
`"Generate a title for this conversation:\n" + userText`.

---

## 6. Output cleanup rules (from spec §5) — must implement exactly
1. Strip `<think>...</think>` reasoning blocks.
2. Split into lines, trim, take first non-empty.
3. If nothing usable → abort (keep default; `pi.setSessionName` not called).
4. Hard cap at `MAX_TITLE_LENGTH` (100) with ellipsis — enforce server-side
   regardless of the ≤50 instruction in the prompt.
5. Persist via `pi.setSessionName(title)`.
6. Wrap persistence + whole routine in try/catch — log, never throw.

---

## 7. Config schema — confirm / minor decisions

The schema already exists. Before coding, confirm these and adjust if needed:
- `auto_session_name.enabled: true` currently **requires** `model`. This is fine and
  keeps resolution simple. If you'd rather allow "enabled with no model ⇒ use current
  session model", relax the enabled branch to make `model` optional and have
  `model-resolver` fall back to `ctx.model`. **Recommendation:** make `model`
  optional even when enabled, since fallback to `ctx.model` is already in the spec.
  If you change the schema, also update `auto-session-name.config.schema.ts` and
  re-run `bun run buildSchema`.
- After any schema change: `bun run buildSchema` regenerates `assets/config.schema.json`.

Example user config (`<cwd>/.pi/extensions/pi-qol/config.json`):
```json
{
  "$schema": "https://raw.githubusercontent.com/0xKahi/pi-qol/main/assets/config.schema.json",
  "auto_session_name": {
    "enabled": true,
    "model": { "provider": "anthropic", "modelId": "claude-haiku-4-5", "reasoning": "off" }
  }
}
```

---

## 8. Testing

Unit tests (bun test) — keep them pure, no live model calls:
- `cleanTitle`:
  - strips `<think>…</think>`
  - picks first non-empty trimmed line
  - returns '' for empty/whitespace/only-think input
  - caps length > 100 with ellipsis
  - unwraps surrounding quotes
- `guards`:
  - `isFirstUserTurn` with 0 vs 1+ user message entries (use a fake
    `sessionManager` with a `getBranch()` stub)
  - `isAlreadyNamed` true/false via fake `pi.getSessionName`
  - `isChildSession` for reason `'fork'` and header `parentSession`
- (Optional) `model-resolver` with a fake `ctx.modelRegistry` (find returns/undefined,
  `getApiKeyAndHeaders` ok/false) verifying fallback chain.

For the model call itself, factor `complete` behind a small injectable seam (e.g.
pass a `completeFn = complete` default param into `generateAndApplyTitle`) so a test
can stub it without network.

---

## 9. Manual verification
1. `bun run check` (biome + tsc) clean.
2. `bun test` green.
3. `bun run buildSchema` updates `assets/config.schema.json`.
4. Live: add config with `enabled:true`, launch a fresh `pi` session, send one
   message, confirm the session name updates shortly after (background), and that
   the assistant response is NOT delayed by titling.
5. Negative checks: disabled config ⇒ no rename; second message ⇒ no rename;
   already-named/resumed session ⇒ no rename; forked session ⇒ no rename.

---

## 10. Build checklist (mirrors spec §7)
- [ ] `src/utils/path.util.ts` (adapted from vim-keys)
- [ ] `src/config-loader.ts` with `isEnabled()` + global/project merge + trust gate
- [ ] `src/index.ts` aggregator: load config on `session_start`, call `registerAutoSessionName`
- [ ] `extensions/auto-session-name/constants.ts`
- [ ] `extensions/auto-session-name/prompt.ts` (verbatim system prompt + builders)
- [ ] `extensions/auto-session-name/guards.ts` (3 guards, timing assumption verified)
- [ ] `extensions/auto-session-name/model-resolver.ts` (config model → ctx.model + auth)
- [ ] `extensions/auto-session-name/title-generator.ts` (build → complete → cleanTitle → setSessionName)
- [ ] `extensions/auto-session-name/index.ts` (`registerAutoSessionName`, fire-and-forget, self-guard on enabled)
- [ ] background execution: NOT awaited, `.catch` swallows/logs
- [ ] output cleanup: strip think tags, first non-empty line, 100-char cap
- [ ] error handling: log-and-continue, never throw into the turn
- [ ] tests for `cleanTitle` + guards
- [ ] `bun run buildSchema`, `bun run check`, `bun test` all pass

---

## 11. Pitfalls / gotchas
- **Never `await`** the titler inside `before_agent_start` — it must not block the
  assistant's first response.
- **No tools** in the title `Context` — omit the `tools` field entirely.
- **Don't trust the model's length rule** — always hard-cap at 100 server-side.
- **Verify the first-turn predicate** (`=== 0` vs `=== 1`) against actual pi timing
  at `before_agent_start`; getBranch may or may not already include the new user msg.
- **`ctx.signal`** may abort mid-generation if the user cancels the turn; pass it to
  `complete()` so the background call dies cleanly. A title aborted this way should
  be swallowed silently.
- **Project trust**: only read project-local config when `ctx.isProjectTrusted()`.
- **`/reload` correctness**: keep the enabled check inside the handler, not at
  registration, so config edits + reload behave.
- **Reasoning/thinking**: `complete()` core options don't take a pi thinking level;
  don't try to force it in v1. Keep the call minimal/cheap.
</content>
</invoke>
