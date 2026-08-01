import { describe, expect, test } from 'bun:test';
import { ConfigSchema, PartialConfigSchema } from '../../src/schemas/config.schema';

describe('context-view config schema', () => {
  test('defaults Context View to disabled when omitted', () => {
    expect(ConfigSchema.parse({}).context_view).toEqual({ enabled: false });
  });

  test('accepts an enabled full config', () => {
    expect(ConfigSchema.parse({ context_view: { enabled: true } }).context_view).toEqual({ enabled: true });
  });

  test('keeps partial overrides partial', () => {
    expect(PartialConfigSchema.parse({ context_view: {} }).context_view).toEqual({});
    expect(PartialConfigSchema.parse({ context_view: { enabled: true } }).context_view).toEqual({ enabled: true });
  });

  test('rejects invalid values', () => {
    expect(ConfigSchema.safeParse({ context_view: { enabled: 'true' } }).success).toBe(false);
  });
});
