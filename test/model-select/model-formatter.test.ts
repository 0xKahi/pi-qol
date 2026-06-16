import { describe, expect, test } from 'bun:test';
import type { Api, Model } from '@earendil-works/pi-ai';
import { ModelFormatter } from '../../src/extensions/model-select/model-formatter';

function model(provider: string, id: string, overrides: Partial<Model<Api>> = {}): Model<Api> {
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
    ...overrides,
  } as Model<Api>;
}

describe('ModelFormatter', () => {
  test('formatTokenCount formats compact token counts', () => {
    expect(ModelFormatter.formatTokenCount(999)).toBe('999');
    expect(ModelFormatter.formatTokenCount(1500)).toBe('1.5K');
    expect(ModelFormatter.formatTokenCount(2000)).toBe('2K');
    expect(ModelFormatter.formatTokenCount(2_000_000)).toBe('2M');
    expect(ModelFormatter.formatTokenCount(2_500_000)).toBe('2.5M');
  });

  test('modelLabel and describeModel include provider, id, capabilities, and token counts', () => {
    const item = model('anthropic', 'claude-test', {
      name: 'Claude Test',
      reasoning: true,
      input: ['text', 'image'],
      contextWindow: 200_000,
      maxTokens: 16_000,
    });

    expect(ModelFormatter.modelLabel(item)).toBe('anthropic/claude-test');
    expect(ModelFormatter.describeModel(item)).toBe('Claude Test • ctx 200K • max 16K • thinking, images');
  });

  test('sortModels puts current first, then provider and id alphabetically', () => {
    const current = model('openai', 'gpt-4o');
    const models = [model('openai', 'gpt-5'), model('anthropic', 'claude'), current, model('google', 'gemini')];

    expect(ModelFormatter.sortModels(models, current).map(ModelFormatter.modelLabel)).toEqual([
      'openai/gpt-4o',
      'anthropic/claude',
      'google/gemini',
      'openai/gpt-5',
    ]);
  });
});
