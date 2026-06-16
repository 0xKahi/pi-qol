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
          { provider: 'anthropic', modelId: 'claude' },
          { provider: 'anthropic', modelId: 'claude' },
          { provider: 'openai', modelId: 'gpt' },
          { provider: 'missing', modelId: 'nope' },
        ],
      }),
    );

    expect(lists.searchItems.map(item => `${item.model.provider}/${item.model.id}`)).toEqual(['openai/gpt', 'anthropic/claude']);
    expect(lists.favouriteItems.map(item => `${item.model.provider}/${item.model.id}`)).toEqual(['anthropic/claude']);
    expect(lists.favouriteWarnings).toEqual(['openai/gpt has no configured auth', 'missing/nope was not found']);
  });
});
