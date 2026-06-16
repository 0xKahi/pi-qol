import type { Api, Model } from '@earendil-works/pi-ai';
import type { ExtensionContext } from '@earendil-works/pi-coding-agent';
import type { Config } from '../../schemas/config.schema';
import { ModelFormatter } from './model-formatter';
import type { ModelItem, ModelLists } from './types';

export async function buildModelLists(ctx: ExtensionContext, config: Config['model_select']): Promise<ModelLists> {
  ctx.modelRegistry.refresh();

  const availableModels = ctx.modelRegistry.getAvailable();
  const providerFilterSet = new Set(config.provider_filter);
  const searchModels = config.provider_filter.length > 0 ? availableModels.filter(model => providerFilterSet.has(model.provider)) : availableModels;
  const sortedSearchModels = ModelFormatter.sortModels(searchModels, ctx.model).map(model => ModelFormatter.toModelItem(model));

  const favouriteItems: ModelItem[] = [];
  const favouriteWarnings: string[] = [];
  const seenFavouriteModels = new Set<string>();

  for (const favourite of config.favourite) {
    const model = ctx.modelRegistry.find(favourite.provider, favourite.modelId);
    const label = `${favourite.provider}/${favourite.modelId}`;

    if (!model) {
      favouriteWarnings.push(`${label} was not found`);
      continue;
    }

    if (!ctx.modelRegistry.hasConfiguredAuth(model)) {
      favouriteWarnings.push(`${label} has no configured auth`);
      continue;
    }

    const key = `${model.provider}\u0000${model.id}`;
    if (seenFavouriteModels.has(key)) {
      continue;
    }
    seenFavouriteModels.add(key);
    favouriteItems.push(ModelFormatter.toModelItem(model));
  }

  return { favouriteItems, favouriteWarnings, searchItems: sortedSearchModels };
}

export function findExactModel(ctx: ExtensionContext, args: string): Model<Api> | undefined {
  const trimmed = args.trim();
  if (!trimmed) {
    return undefined;
  }

  const slashIndex = trimmed.indexOf('/');
  if (slashIndex > 0 && slashIndex < trimmed.length - 1) {
    const provider = trimmed.slice(0, slashIndex).trim();
    const modelId = trimmed.slice(slashIndex + 1).trim();
    return ctx.modelRegistry.find(provider, modelId);
  }

  const [provider, modelId] = trimmed.split(/\s+/, 2);
  if (provider && modelId) {
    return ctx.modelRegistry.find(provider, modelId);
  }

  return undefined;
}
