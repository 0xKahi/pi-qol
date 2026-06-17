import { describe, expect, test } from 'bun:test';
import { ConfigSchema, PartialConfigSchema } from '../../src/schemas/config.schema';

describe('custom-footer config schema', () => {
  test('materializes nested defaults when custom_footer is omitted or partially provided', () => {
    expect(ConfigSchema.parse({}).custom_footer).toMatchObject({
      enabled: false,
      colors: { anthropicUsage: '#D97706', codexUsage: '#10B981' },
      icons: { directory: ' ', refresh: '', cache: ' ', cacheRead: ' ', cacheWrite: ' ' },
      display: { tokens: true, cache: true },
    });

    expect(ConfigSchema.parse({ custom_footer: { enabled: true } }).custom_footer.icons.cache).toBe(' ');
  });

  test('partial config does not default enabled to false', () => {
    expect(PartialConfigSchema.parse({ custom_footer: { colors: { directory: '#ffffff' } } }).custom_footer).toEqual({
      colors: { directory: '#ffffff' },
    });
  });
});
