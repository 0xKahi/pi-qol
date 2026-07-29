import { describe, expect, test } from 'bun:test';
import type { Api, Model } from '@earendil-works/pi-ai';
import type { ExtensionAPI, ExtensionContext } from '@earendil-works/pi-coding-agent';
import type { ConfigLoader } from '../../src/config-loader';
import { applySelectedModel, showModelSelector } from '../../src/extensions/model-select';
import { ModelSelectConfigSchema } from '../../src/schemas/model-select.config.schema';
import type { ReasoningLevel } from '../../src/schemas/shared-config.schema';

function model(overrides: Partial<Model<Api>> = {}): Model<Api> {
  return {
    id: 'test-model',
    name: 'Test Model',
    api: 'test-api',
    provider: 'test-provider',
    baseUrl: 'https://example.com',
    reasoning: true,
    input: ['text'],
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
    contextWindow: 128_000,
    maxTokens: 8_192,
    ...overrides,
  } as Model<Api>;
}

function config(defaultReasoning?: ReasoningLevel) {
  return ModelSelectConfigSchema.parse({ default_reasoning: defaultReasoning });
}

function harness(setModelResult = true) {
  const thinkingLevels: ReasoningLevel[] = [];
  const notifications: Array<{ message: string; level: string }> = [];
  const pi = {
    setModel: async () => setModelResult,
    setThinkingLevel: (level: ReasoningLevel) => thinkingLevels.push(level),
  } as unknown as ExtensionAPI;
  const ctx = {
    ui: {
      notify: (message: string, level: string) => notifications.push({ message, level }),
    },
  } as unknown as ExtensionContext;

  return { pi, ctx, thinkingLevels, notifications };
}

describe('model-select default reasoning', () => {
  test('sets an exactly supported reasoning level after selecting a model', async () => {
    const { pi, ctx, thinkingLevels } = harness();

    await applySelectedModel(pi, ctx, model(), config('high'));

    expect(thinkingLevels).toEqual(['high']);
  });

  test('silently leaves an unsupported reasoning level untouched', async () => {
    const { pi, ctx, thinkingLevels, notifications } = harness();

    await applySelectedModel(pi, ctx, model({ thinkingLevelMap: { low: null } }), config('low'));

    expect(thinkingLevels).toEqual([]);
    expect(notifications).toEqual([{ message: 'Model set to test-provider/test-model', level: 'info' }]);
  });

  test('applies off to a model with no reasoning support', async () => {
    const { pi, ctx, thinkingLevels } = harness();

    await applySelectedModel(pi, ctx, model({ reasoning: false }), config('off'));

    expect(thinkingLevels).toEqual(['off']);
  });

  test('does not set a thinking level when default reasoning is unset', async () => {
    const { pi, ctx, thinkingLevels } = harness();

    await applySelectedModel(pi, ctx, model(), config());

    expect(thinkingLevels).toEqual([]);
  });

  test('does not set a thinking level when model selection fails', async () => {
    const { pi, ctx, thinkingLevels } = harness(false);

    await applySelectedModel(pi, ctx, model(), config('high'));

    expect(thinkingLevels).toEqual([]);
  });

  test('applies default reasoning through the exact provider/model shortcut', async () => {
    const selectedModel = model();
    const { pi, thinkingLevels, notifications } = harness();
    const ctx = {
      hasUI: false,
      modelRegistry: {
        refresh: () => undefined,
        find: (provider: string, modelId: string) =>
          provider === selectedModel.provider && modelId === selectedModel.id ? selectedModel : undefined,
      },
      ui: {
        notify: (message: string, level: string) => notifications.push({ message, level }),
      },
    } as unknown as ExtensionContext;
    const configLoader = {
      getModelSelect: () => config('medium'),
    } as ConfigLoader;

    await showModelSelector(pi, 'test-provider/test-model', ctx, configLoader);

    expect(thinkingLevels).toEqual(['medium']);
  });
});
