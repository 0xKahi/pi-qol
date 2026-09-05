import { describe, expect, test } from 'bun:test';
import { ConfigSchema, PartialConfigSchema } from '../../src/schemas/config.schema';

describe('custom-footer config schema', () => {
  test('materializes nested defaults when custom_footer is omitted or partially provided', () => {
    expect(ConfigSchema.parse({}).custom_footer).toMatchObject({
      enabled: false,
      colors: { anthropicUsage: '#D97706', codexUsage: '#10B981' },
      icons: { directory: ' ', refresh: '', cache: ' ', cacheRead: ' ', cacheWrite: ' ' },
      display: { tokens: true, cache: true, agentName: false },
      defaultAgentName: 'DEFAULT',
    });

    expect(ConfigSchema.parse({ custom_footer: { enabled: true } }).custom_footer.icons.cache).toBe(' ');
  });

  test('accepts agent-name configuration without transforming it', () => {
    const footer = ConfigSchema.parse({
      custom_footer: {
        enabled: true,
        display: { agentName: true },
        colors: { agentName: '#A1b2C3' },
        defaultAgentName: '  Build Bot  ',
      },
    }).custom_footer;

    expect(footer.display.agentName).toBe(true);
    expect(footer.colors.agentName).toBe('#A1b2C3');
    expect(footer.defaultAgentName).toBe('  Build Bot  ');
  });

  test('partial config does not materialize defaults', () => {
    expect(
      PartialConfigSchema.parse({
        custom_footer: {
          colors: { directory: '#ffffff', agentName: '#112233' },
          display: { agentName: true },
          defaultAgentName: ' Reviewer ',
        },
      }).custom_footer,
    ).toEqual({
      colors: { directory: '#ffffff', agentName: '#112233' },
      display: { agentName: true },
      defaultAgentName: ' Reviewer ',
    });
  });

  test('rejects whitespace-only default agent names', () => {
    expect(() => ConfigSchema.parse({ custom_footer: { defaultAgentName: ' \n\t ' } })).toThrow();
  });

  test('rejects invalid configured agent-name colors', () => {
    expect(() => ConfigSchema.parse({ custom_footer: { colors: { agentName: '#fff' } } })).toThrow();
    expect(() => PartialConfigSchema.parse({ custom_footer: { colors: { agentName: 'red' } } })).toThrow();
  });
});
