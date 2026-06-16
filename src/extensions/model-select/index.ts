import type { Api, Model } from '@earendil-works/pi-ai';
import type { ExtensionAPI, ExtensionCommandContext, ExtensionContext } from '@earendil-works/pi-coding-agent';
import type { ConfigLoader } from '../../config-loader';
import { COMMAND_NAME, PI_VIM_KEY_EVENT_ID } from './constants';
import { ModelFormatter } from './model-formatter';
import { buildModelLists, findExactModel } from './model-lists';
import { ModelSelectDialog } from './model-select-dialog';
import type { DialogResult } from './types';

async function applySelectedModel(pi: ExtensionAPI, ctx: ExtensionContext, model: Model<Api>): Promise<void> {
  const success = await pi.setModel(model);
  if (success) {
    ctx.ui.notify(`Model set to ${ModelFormatter.modelLabel(model)}`, 'info');
  } else {
    ctx.ui.notify(`No configured auth for ${ModelFormatter.modelLabel(model)}`, 'error');
  }
}

async function showModelSelector(pi: ExtensionAPI, args: string, ctx: ExtensionContext, configLoader: ConfigLoader): Promise<void> {
  // `waitForIdle` only exists on command contexts. When invoked from the event
  // bus we get a plain ExtensionContext, so fall back to a best-effort guard.
  if ('waitForIdle' in ctx && typeof ctx.waitForIdle === 'function') {
    await (ctx as ExtensionCommandContext).waitForIdle();
  }
  ctx.modelRegistry.refresh();

  const exactModel = findExactModel(ctx, args);
  if (exactModel) {
    await applySelectedModel(pi, ctx, exactModel);
    return;
  }

  if (!ctx.hasUI) {
    ctx.ui.notify('The /select-model picker requires an interactive UI. Pass provider/modelId to select directly.', 'warning');
    return;
  }

  const config = configLoader.getModelSelect();
  const modelLists = await buildModelLists(ctx, config);
  const registryError = ctx.modelRegistry.getError();

  const selected = await ctx.ui.custom<DialogResult>(
    (tui, theme, keybindings, done) =>
      new ModelSelectDialog(tui, theme, keybindings, {
        currentModel: ctx.model,
        favouriteItems: modelLists.favouriteItems,
        favouriteWarnings: modelLists.favouriteWarnings,
        hasFavouriteSection: config.favourite.length > 0,
        searchItems: modelLists.searchItems,
        providerFilter: config.provider_filter,
        configWarnings: registryError ? [`models.json: ${registryError}`] : [],
        initialSearch: args.trim(),
        layout: config.layout,
        onDone: done,
      }),
    config.layout === 'overlay'
      ? {
          overlay: true,
          overlayOptions: {
            anchor: 'center',
            width: '85%',
            margin: 1,
          },
        }
      : undefined,
  );

  if (selected) {
    await applySelectedModel(pi, ctx, selected);
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
