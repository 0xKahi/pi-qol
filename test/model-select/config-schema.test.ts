import { describe, expect, test } from 'bun:test';
import { ConfigSchema, PartialConfigSchema } from '../../src/schemas/config.schema';

describe('model-select config schema', () => {
  test('materializes group and tab visibility defaults', () => {
    expect(ConfigSchema.parse({}).model_select).toEqual({
      enabled: false,
      favourite: [],
      favourite_label: 'Favourites',
      groups: [],
      hide_tabs: { groups: false, search: false },
      provider_filter: [],
      layout: 'inline',
    });

    expect(
      ConfigSchema.parse({
        model_select: {
          favourite: [{ provider: 'anthropic', modelId: 'claude' }],
          hide_tabs: {},
        },
      }).model_select,
    ).toMatchObject({
      favourite: [{ provider: 'anthropic', modelId: 'claude', groups: [] }],
      groups: [],
      hide_tabs: { groups: false, search: false },
    });
  });

  test('preserves a custom favourite label, group order, and favourite memberships', () => {
    const parsed = ConfigSchema.parse({
      model_select: {
        favourite_label: 'Pinned',
        groups: ['work', 'fast'],
        favourite: [{ provider: 'openai', modelId: 'gpt', groups: ['fast', 'work'] }],
        hide_tabs: { groups: true },
      },
    }).model_select;

    expect(parsed.favourite_label).toBe('Pinned');
    expect(parsed.groups).toEqual(['work', 'fast']);
    expect(parsed.favourite[0]?.groups).toEqual(['fast', 'work']);
    expect(parsed.hide_tabs).toEqual({ groups: true, search: false });
  });

  test('rejects empty favourite labels, group names, and membership names', () => {
    expect(ConfigSchema.safeParse({ model_select: { favourite_label: '' } }).success).toBe(false);
    expect(ConfigSchema.safeParse({ model_select: { groups: [''] } }).success).toBe(false);
    expect(
      ConfigSchema.safeParse({
        model_select: { favourite: [{ provider: 'openai', modelId: 'gpt', groups: [''] }] },
      }).success,
    ).toBe(false);
  });

  test('partial model-select config accepts label overrides and omitted fields without defaulting the section', () => {
    expect(PartialConfigSchema.parse({ model_select: { favourite_label: 'Pinned' } }).model_select).toEqual({
      favourite_label: 'Pinned',
    });
    expect(PartialConfigSchema.parse({ model_select: { groups: ['work'] } }).model_select).toEqual({ groups: ['work'] });
  });
});
