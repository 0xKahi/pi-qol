import type { Api, AssistantMessage, Context, Model, SimpleStreamOptions, TextContent } from '@earendil-works/pi-ai';
import { completeSimple } from '@earendil-works/pi-ai/compat';
import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import type { ResolvedModel } from '../../utils/model-resolver.util';
import { MAX_RETRIES, MAX_TITLE_LENGTH, TITLE_MAX_TOKENS } from './constants';
import { buildTitleContext } from './prompt';

type CompleteFn = (model: Model<Api>, context: Context, options?: SimpleStreamOptions) => Promise<AssistantMessage>;

export type GenerateTitleResult = {
  text?: string;
  error?: string;
};

export class AutoSessionNameTitleGenerator {
  static async generateAndApplyTitle(deps: {
    pi: Pick<ExtensionAPI, 'setSessionName'>;
    userText: string;
    resolvedModel: ResolvedModel;
    signal?: AbortSignal;
    completeFn?: CompleteFn;
  }): Promise<GenerateTitleResult> {
    try {
      const completeTitle = deps.completeFn ?? completeSimple;
      const msg = await completeTitle(
        deps.resolvedModel.model,
        buildTitleContext(deps.userText),
        AutoSessionNameTitleGenerator.buildTitleOptions(deps.resolvedModel, deps.signal),
      );

      const rawText = AutoSessionNameTitleGenerator.extractText(msg);
      const title = AutoSessionNameTitleGenerator.cleanTitle(rawText);
      if (!title) {
        return {
          error: AutoSessionNameTitleGenerator.buildEmptyTitleError(msg, rawText),
          text: rawText || undefined,
        };
      }

      deps.pi.setSessionName(title);
      return { text: title };
    } catch (err) {
      const error = AutoSessionNameTitleGenerator.formatError(err);
      return { error };
    }
  }

  static cleanTitle(raw: string): string {
    const withoutThinking = raw.replace(/<think>[\s\S]*?<\/think>/gi, '').replace(/<\/?think>/gi, '');
    const title = withoutThinking
      .split(/\r?\n/)
      .map(line => line.trim())
      .find(Boolean);

    if (!title) return '';

    const unwrapped = AutoSessionNameTitleGenerator.unwrapSurroundingQuotes(title);
    if (!unwrapped) return '';
    if (unwrapped.length <= MAX_TITLE_LENGTH) return unwrapped;

    return `${unwrapped.slice(0, MAX_TITLE_LENGTH - 1).trimEnd()}…`;
  }

  private static extractText(msg: AssistantMessage): string {
    return msg.content
      .filter((content): content is TextContent => content.type === 'text')
      .map(content => content.text)
      .join('')
      .trim();
  }

  private static unwrapSurroundingQuotes(value: string): string {
    return value.replace(/^("+|'+|`+)([\s\S]*)\1$/, '$2').trim();
  }

  private static buildTitleOptions(resolvedModel: ResolvedModel, signal?: AbortSignal): SimpleStreamOptions {
    const base: SimpleStreamOptions = {
      apiKey: resolvedModel.apiKey,
      headers: resolvedModel.headers,
      signal,
      maxRetries: MAX_RETRIES,
      maxTokens: TITLE_MAX_TOKENS,
    };

    if (!resolvedModel.model.reasoning || !resolvedModel.reasoning || resolvedModel.reasoning === 'off') return base;

    return {
      ...base,
      reasoning: resolvedModel.reasoning,
    };
  }

  private static buildEmptyTitleError(msg: AssistantMessage, rawText: string): string {
    const contentTypes = msg.content.map(content => content.type).join(', ') || 'none';
    const details = [`model returned no title`, `stopReason=${msg.stopReason}`, `contentTypes=${contentTypes}`];

    if (msg.errorMessage) details.push(`errorMessage=${msg.errorMessage}`);
    if (rawText) details.push(`rawText=${rawText}`);

    return details.join('; ');
  }

  private static formatError(err: unknown): string {
    if (err instanceof Error) return err.message;
    if (typeof err === 'string') return err;

    try {
      return JSON.stringify(err);
    } catch {
      return String(err);
    }
  }
}
