# assets/

## Responsibility

The `assets/` directory holds static, non-source artifacts that support the `pi-qol` extension. The primary artifact is `config.schema.json`, a JSON Schema (draft-07) that defines, documents, and validates the user-facing configuration. It declares available features, default values, accepted value ranges, and required fields so that editors, IDEs, and the extension itself can load and validate `pi-qol` configuration safely.

## Design Patterns

- **Schema-driven configuration**: User settings are governed by a single JSON Schema, ensuring defaults, types, and constraints live in one authoritative location.
- **Feature-flagged modules**: Each top-level feature (`auto_session_name`, `model_select`, `custom_footer`) is wrapped in an `enabled` boolean, allowing independent activation and deactivation.
- **Nested option objects**: Features group related settings into sub-objects (`model`, `favourite`, `colors`, `icons`, `display`) to keep the configuration hierarchical and self-documenting.
- **Enum constraints for UX modes**: Discrete choices such as `reasoning` levels and `layout` modes use JSON Schema `enum` values to prevent invalid configuration.

## Data & Control Flow

1. The extension reads the user's configuration (e.g., an editor settings file or `pi-qol.json`).
2. The configuration is validated against `assets/config.schema.json`.
3. Based on each feature's `enabled` flag, individual feature modules are initialized.
4. Feature modules read their respective nested configuration objects (`model.*`, `favourite[]`, `provider_filter`, `colors.*`, etc.) to drive behavior.
5. Optional settings fall back to the schema-defined `default` values when absent.

## Integration Points

- **Extension host / editor settings**: The schema is referenced by editor configurations (via the `$schema` URL or a local path) to provide autocomplete, validation, and tooltips.
- **Feature modules in `src/`**: Source code parses the validated configuration and maps each top-level property to a corresponding feature implementation.
- **Default value provider**: The schema's `default` fields act as the canonical source of truth for fallback values across the extension.
