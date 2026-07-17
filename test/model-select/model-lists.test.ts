import { describe, expect, test } from 'bun:test';
import type { Api, Model } from '@earendil-works/pi-ai';
import type { ExtensionContext } from '@earendil-works/pi-coding-agent';
import { buildModelLists, findExactModel } from '../../src/extensions/model-select/model-lists';
import type { Config } from '../../src/schemas/config.schema';

function model(provider: string, id: string): Model<Api> {
  return {
    id,
    name: `${provider} ${id}`,
    api: 'test-api',
    provider,
    baseUrl: 'https://example.com',
    reasoning: false,
    input: ['text'],
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
    contextWindow: 128_000,
    maxTokens: 8_192,
  } as Model<Api>;
}

function ctx(models: Model<Api>[], authenticated: Set<string> = new Set(models.map(item => `${item.provider}/${item.id}`))): ExtensionContext {
  const find = (provider: string, id: string) => models.find(item => item.provider === provider && item.id === id);

  return {
    model: models[0],
    modelRegistry: {
      refresh: () => undefined,
      getAvailable: () => models,
      find,
      hasConfiguredAuth: (item: Model<Api>) => authenticated.has(`${item.provider}/${item.id}`),
    },
  } as unknown as ExtensionContext;
}

function config(overrides: Partial<Config['model_select']> = {}): Config['model_select'] {
  return {
    enabled: true,
    favourite: [],
    favourite_label: 'Favourites',
    groups: [],
    hide_tabs: { groups: false, search: false },
    provider_filter: [],
    layout: 'inline',
    ...overrides,
  };
}

describe('model-select model lists', () => {
  test('findExactModel parses provider/modelId and provider modelId', () => {
    const anthropic = model('anthropic', 'claude');
    const openai = model('openai', 'gpt');
    const fakeCtx = ctx([anthropic, openai]);

    expect(findExactModel(fakeCtx, 'anthropic/claude')).toBe(anthropic);
    expect(findExactModel(fakeCtx, 'openai gpt')).toBe(openai);
    expect(findExactModel(fakeCtx, '')).toBeUndefined();
    expect(findExactModel(fakeCtx, 'anthropic')).toBeUndefined();
  });

  test('buildModelLists filters search models, dedupes favourites, and reports favourite warnings', async () => {
    const anthropic = model('anthropic', 'claude');
    const openai = model('openai', 'gpt');
    const google = model('google', 'gemini');
    const fakeCtx = ctx([openai, google, anthropic], new Set(['anthropic/claude']));

    const lists = await buildModelLists(
      fakeCtx,
      config({
        provider_filter: ['anthropic', 'openai'],
        favourite: [
          { provider: 'anthropic', modelId: 'claude', groups: [] },
          { provider: 'anthropic', modelId: 'claude', groups: [] },
          { provider: 'openai', modelId: 'gpt', groups: [] },
          { provider: 'missing', modelId: 'nope', groups: [] },
        ],
      }),
    );

    expect(lists.searchItems.map(item => `${item.model.provider}/${item.model.id}`)).toEqual(['openai/gpt', 'anthropic/claude']);
    expect(lists.favouriteItems.map(item => `${item.model.provider}/${item.model.id}`)).toEqual(['anthropic/claude']);
    expect(lists.favouriteWarnings).toEqual(['openai/gpt has no configured auth', 'missing/nope was not found']);
    expect(lists.groupLists).toEqual([]);
  });

  test('builds exact case-sensitive group subsets in favourite order independently of provider filtering', async () => {
    const anthropic = model('anthropic', 'claude');
    const openai = model('openai', 'gpt');
    const google = model('google', 'gemini');

    const lists = await buildModelLists(
      ctx([anthropic, openai, google]),
      config({
        groups: ['work', 'fast', 'empty'],
        provider_filter: ['openai'],
        favourite: [
          { provider: 'anthropic', modelId: 'claude', groups: ['work', 'fast', 'unknown', 'Work'] },
          { provider: 'google', modelId: 'gemini', groups: [] },
          { provider: 'openai', modelId: 'gpt', groups: ['work'] },
        ],
      }),
    );

    expect(lists.favouriteItems.map(item => item.model.id)).toEqual(['claude', 'gemini', 'gpt']);
    expect(lists.groupLists.map(group => [group.name, group.items.map(item => item.model.id)])).toEqual([
      ['work', ['claude', 'gpt']],
      ['fast', ['claude']],
      ['empty', []],
    ]);
    expect(lists.searchItems.map(item => item.model.id)).toEqual(['gpt']);
  });

  test('deduplicates groups and favourites by first occurrence without merging memberships', async () => {
    const anthropic = model('anthropic', 'claude');
    const openai = model('openai', 'gpt');

    const lists = await buildModelLists(
      ctx([anthropic, openai]),
      config({
        groups: ['first', 'second', 'first'],
        favourite: [
          { provider: 'anthropic', modelId: 'claude', groups: ['first'] },
          { provider: 'anthropic', modelId: 'claude', groups: ['second'] },
          { provider: 'openai', modelId: 'gpt', groups: ['second'] },
        ],
      }),
    );

    expect(lists.favouriteItems.map(item => item.model.id)).toEqual(['claude', 'gpt']);
    expect(lists.groupLists.map(group => [group.name, group.items.map(item => item.model.id)])).toEqual([
      ['first', ['claude']],
      ['second', ['gpt']],
    ]);
  });

  test('excludes unavailable or unauthenticated favourites from every group', async () => {
    const anthropic = model('anthropic', 'claude');
    const openai = model('openai', 'gpt');

    const lists = await buildModelLists(
      ctx([anthropic, openai], new Set(['anthropic/claude'])),
      config({
        groups: ['work'],
        favourite: [
          { provider: 'openai', modelId: 'gpt', groups: ['work'] },
          { provider: 'missing', modelId: 'nope', groups: ['work'] },
          { provider: 'anthropic', modelId: 'claude', groups: ['work'] },
        ],
      }),
    );

    expect(lists.groupLists[0]?.items.map(item => item.model.id)).toEqual(['claude']);
    expect(lists.favouriteWarnings).toEqual(['openai/gpt has no configured auth', 'missing/nope was not found']);
  });
});
