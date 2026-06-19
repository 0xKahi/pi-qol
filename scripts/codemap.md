# scripts/

## Responsibility

This directory contains build-time and maintenance scripts for the `pi-qol` project. Its current job is to generate the JSON Schema document that describes the extension's configuration format from the canonical Zod schema defined in the source tree.

## Design Patterns

- **Entry point / logic separation**: `build-schema.ts` is the executable entry point responsible for I/O and logging, while `build-schema-document.ts` exposes a pure `createConfigJsonSchema()` function that only knows how to produce the schema object.
- **Pure schema factory**: `createConfigJsonSchema()` has no side effects; it takes no arguments and returns a `Record<string, unknown>` representing the final JSON Schema.
- **Bun-native runtime I/O**: The script uses the Bun shebang (`#!/usr/bin/env bun`) and `Bun.write()` for asynchronous file output.
- **Schema-driven configuration**: The generated artifact is derived directly from `src/schemas/config.schema.ts`, keeping user-facing documentation and runtime validation in sync.

## Data & Control Flow

1. `build-schema.ts::main()` is invoked as a Bun script.
2. It calls `createConfigJsonSchema()` from `build-schema-document.ts`.
3. `createConfigJsonSchema()` imports the `ConfigSchema` Zod object from `../src/schemas/config.schema.ts`.
4. `z.toJSONSchema(ConfigSchema, { target: 'draft-7', ... })` converts the Zod schema into a JSON Schema object.
5. The function merges schema metadata (`$schema`, `$id`, `title`, `description`) on top of the generated schema.
6. `main()` serializes the result with `JSON.stringify(..., null, 2)` and writes it to `assets/config.schema.json` via `Bun.write()`.
7. A success message is logged to the console.

## Integration Points

- **Zod**: Uses the `zod` library and its `toJSONSchema` helper for schema conversion.
- **`../src/schemas/config.schema.ts`**: Source of truth for the extension configuration shape; changes to this file are reflected in the generated schema.
- **`assets/config.schema.json`**: Output destination for the generated JSON Schema.
- **Bun runtime**: The script is written specifically for Bun (shebang + `Bun.write`).
