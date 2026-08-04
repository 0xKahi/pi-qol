import { type Api, getSupportedThinkingLevels, type Model } from '@earendil-works/pi-ai';
import type { ExtensionAPI, ExtensionCommandContext, ExtensionContext } from '@earendil-works/pi-coding-agent';
import type { ConfigLoader } from '../../config-loader';
import { presentModal } from '../../libs/modal';
import type { ModelSelectConfig } from '../../schemas/model-select.config.schema';
import { COMMAND_NAME, PI_VIM_KEY_EVENT_ID } from './constants';
import { ModelFormatter } from './model-formatter';
import { buildModelLists, findExactModel } from './model-lists';
import { ModelSelectDialog } from './model-select-dialog';
import type { DialogResult } from './types';

export async function applySelectedModel(pi: ExtensionAPI, ctx: ExtensionContext, model: Model<Api>, config: ModelSelectConfig): Promise<void> {
  const success = await pi.setModel(model);
  if (success) {
    const defaultReasoning = config.default_reasoning;
    if (defaultReasoning && getSupportedThinkingLevels(model).includes(defaultReasoning)) {
      pi.setThinkingLevel(defaultReasoning);
    }
    ctx.ui.notify(`Model set to ${ModelFormatter.modelLabel(model)}`, 'info');
  } else {
    ctx.ui.notify(`No configured auth for ${ModelFormatter.modelLabel(model)}`, 'error');
  }
}

export async function showModelSelector(pi: ExtensionAPI, args: string, ctx: ExtensionContext, configLoader: ConfigLoader): Promise<void> {
  // `waitForIdle` only exists on command contexts. When invoked from the event
  // bus we get a plain ExtensionContext, so fall back to a best-effort guard.
  if ('waitForIdle' in ctx && typeof ctx.waitForIdle === 'function') {
    await (ctx as ExtensionCommandContext).waitForIdle();
  }
  ctx.modelRegistry.refresh();

  const config = configLoader.getModelSelect();
  const exactModel = findExactModel(ctx, args);
  if (exactModel) {
    await applySelectedModel(pi, ctx, exactModel, config);
    return;
  }

  if (!ctx.hasUI) {
    ctx.ui.notify('The /select-model picker requires an interactive UI. Pass provider/modelId to select directly.', 'warning');
    return;
  }

  const modelLists = await buildModelLists(ctx, config);
  const registryError = ctx.modelRegistry.getError();

  const selected = await presentModal<DialogResult>(
    ctx.ui,
    config.layout,
    (tui, theme, keybindings, done, frame) =>
      new ModelSelectDialog(tui, theme, keybindings, {
        currentModel: ctx.model,
        favouriteItems: modelLists.favouriteItems,
        favouriteLabel: config.favourite_label,
        favouriteWarnings: modelLists.favouriteWarnings,
        groupLists: modelLists.groupLists,
        searchItems: modelLists.searchItems,
        hideGroupTabs: config.hide_tabs.groups,
        hideSearchTab: config.hide_tabs.search,
        providerFilter: config.provider_filter,
        defaultReasoning: config.default_reasoning,
        configWarnings: registryError ? [`models.json: ${registryError}`] : [],
        initialSearch: args.trim(),
        frame,
        onDone: done,
      }),
  );

  if (selected) {
    await applySelectedModel(pi, ctx, selected, config);
  }
}

function activateModelSelect(pi: ExtensionAPI, deps: { config: ConfigLoader; initialCtx?: ExtensionContext }) {
  // Keep a reference to the latest context so the event-bus handler (which gets
  // no context of its own) can open the modal too. Lazy activation may happen
  // during session_start, so seed this with the context that triggered it.
  let latestCtx: ExtensionContext | undefined = deps.initialCtx;

  pi.on('session_start', (_event, ctx) => {
    latestCtx = ctx;
  });

  pi.registerCommand(COMMAND_NAME, {
    description: 'Select/search models with favourites and provider filtering',
    handler: async (args, ctx) => {
      latestCtx = ctx;
      if (!deps.config.isEnabled('model_select')) {
        ctx.ui.notify('(pi-qol) model_select is disabled', 'warning');
        return;
      }
      await showModelSelector(pi, args, ctx, deps.config);
    },
  });

  // Cross-extension activation: another extension can open the modal via
  //   pi.events.emit(PI_VIM_KEY_EVENT_ID)
  pi.events.on(PI_VIM_KEY_EVENT_ID, () => {
    const ctx = latestCtx;
    if (!ctx || !deps.config.isEnabled('model_select')) {
      return;
    }
    void showModelSelector(pi, '', ctx, deps.config).catch(error => {
      ctx.ui.notify(`Failed to open model selector: ${error instanceof Error ? error.message : String(error)}`, 'error');
    });
  });
}

export function registerModelSelect(pi: ExtensionAPI, deps: { config: ConfigLoader }) {
  let modelSelectRegistered = false;

  pi.on('session_start', (_event, ctx) => {
    if (!deps.config.isEnabled('model_select') || modelSelectRegistered) {
      return;
    }

    activateModelSelect(pi, { config: deps.config, initialCtx: ctx });
    modelSelectRegistered = true;
  });
}
