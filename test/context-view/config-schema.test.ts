import { describe, expect, test } from 'bun:test';
import { ConfigSchema, PartialConfigSchema } from '../../src/schemas/config.schema';

describe('context-view config schema', () => {
  test('defaults Context View to disabled and inline when omitted', () => {
    expect(ConfigSchema.parse({}).context_view).toEqual({ enabled: false, auto_probing: true, layout: 'inline' });
  });

  test('accepts enabled inline and overlay layouts', () => {
    expect(ConfigSchema.parse({ context_view: { enabled: true } }).context_view).toEqual({ enabled: true, auto_probing: true, layout: 'inline' });
    expect(ConfigSchema.parse({ context_view: { enabled: true, layout: 'overlay' } }).context_view).toEqual({
      enabled: true,
      auto_probing: true,
      layout: 'overlay',
    });
  });

  test('keeps partial overrides partial', () => {
    expect(PartialConfigSchema.parse({ context_view: {} }).context_view).toEqual({});
    expect(PartialConfigSchema.parse({ context_view: { enabled: true } }).context_view).toEqual({ enabled: true });
    expect(PartialConfigSchema.parse({ context_view: { layout: 'overlay' } }).context_view).toEqual({ layout: 'overlay' });
  });

  test('allows disabling automatic probing without adding partial defaults', () => {
    expect(ConfigSchema.parse({ context_view: { auto_probing: false } }).context_view.auto_probing).toBe(false);
    expect(PartialConfigSchema.parse({ context_view: { auto_probing: false } }).context_view).toEqual({ auto_probing: false });
  });

  test('rejects invalid values', () => {
    for (const auto_probing of ['true', 1, null]) {
      expect(ConfigSchema.safeParse({ context_view: { auto_probing } }).success).toBe(false);
      expect(PartialConfigSchema.safeParse({ context_view: { auto_probing } }).success).toBe(false);
    }
    expect(ConfigSchema.safeParse({ context_view: { enabled: 'true' } }).success).toBe(false);
    expect(ConfigSchema.safeParse({ context_view: { layout: 'floating' } }).success).toBe(false);
    expect(PartialConfigSchema.safeParse({ context_view: { layout: 'floating' } }).success).toBe(false);
  });
});
