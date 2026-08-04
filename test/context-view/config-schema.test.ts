import { describe, expect, test } from 'bun:test';
import { ConfigSchema, PartialConfigSchema } from '../../src/schemas/config.schema';

describe('context-view config schema', () => {
  test('defaults Context View to disabled and inline when omitted', () => {
    expect(ConfigSchema.parse({}).context_view).toEqual({ enabled: false, layout: 'inline' });
  });

  test('accepts enabled inline and overlay layouts', () => {
    expect(ConfigSchema.parse({ context_view: { enabled: true } }).context_view).toEqual({ enabled: true, layout: 'inline' });
    expect(ConfigSchema.parse({ context_view: { enabled: true, layout: 'overlay' } }).context_view).toEqual({ enabled: true, layout: 'overlay' });
  });

  test('keeps partial overrides partial', () => {
    expect(PartialConfigSchema.parse({ context_view: {} }).context_view).toEqual({});
    expect(PartialConfigSchema.parse({ context_view: { enabled: true } }).context_view).toEqual({ enabled: true });
    expect(PartialConfigSchema.parse({ context_view: { layout: 'overlay' } }).context_view).toEqual({ layout: 'overlay' });
  });

  test('rejects invalid values', () => {
    expect(ConfigSchema.safeParse({ context_view: { enabled: 'true' } }).success).toBe(false);
    expect(ConfigSchema.safeParse({ context_view: { layout: 'floating' } }).success).toBe(false);
    expect(PartialConfigSchema.safeParse({ context_view: { layout: 'floating' } }).success).toBe(false);
  });
});
