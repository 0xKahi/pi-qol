import type { Api, Model } from '@earendil-works/pi-ai';
import type { ExtensionContext } from '@earendil-works/pi-coding-agent';
import type { ModelConfig } from '../schemas/shared-config.schema';

export type ResolvedModel = {
  model: Model<Api>;
  apiKey?: string;
  headers?: Record<string, string>;
  reasoning?: ModelConfig['reasoning'];
  isOauth?: boolean;
};

export type ResolveModelResult = {
  error?: string;
  result?: ResolvedModel;
};

export class ModelResolver {
  constructor(private readonly ctx: ExtensionContext) {}

  sessionModel(): Model<Api> | undefined {
    return this.ctx.model;
  }

  async resolveModel(configModel?: ModelConfig): Promise<ResolveModelResult> {
    const errors: string[] = [];
    const candidates: Array<{ model: Model<Api>; reasoning?: ModelConfig['reasoning'] }> = [];

    if (configModel) {
      const found = this.ctx.modelRegistry.find(configModel.provider, configModel.modelId);
      if (found) {
        candidates.push({ model: found, reasoning: configModel.reasoning });
      } else {
        errors.push(`Configured model not found: ${configModel.provider}/${configModel.modelId}`);
      }
    }

    const sessionModel = this.sessionModel();
    if (sessionModel && !candidates.some(candidate => candidate.model.provider === sessionModel.provider && candidate.model.id === sessionModel.id)) {
      candidates.push({ model: sessionModel });
    }

    for (const candidate of candidates) {
      const { model } = candidate;
      const auth = await this.ctx.modelRegistry.getApiKeyAndHeaders(model);
      if (auth.ok) {
        return {
          error: errors.length > 0 ? errors.join('\n') : undefined,
          result: {
            model,
            apiKey: auth.apiKey,
            headers: auth.headers,
            reasoning: candidate.reasoning,
            isOauth: this.ctx.modelRegistry.isUsingOAuth(model),
          },
        };
      }

      const isConfiguredModel = configModel && model.provider === configModel.provider && model.id === configModel.modelId;
      errors.push(`${isConfiguredModel ? 'Configured' : 'Session'} model auth failed for ${model.provider}/${model.id}: ${auth.error}`);
    }

    if (!sessionModel) errors.push('No active session model is available as a fallback.');

    return {
      error: errors.length > 0 ? errors.join('\n') : 'No model could be resolved.',
    };
  }
}
