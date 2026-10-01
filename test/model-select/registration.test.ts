import { expect, test } from 'bun:test';
import type { ExtensionAPI, ExtensionContext, KeybindingsManager, Theme } from '@earendil-works/pi-coding-agent';
import type { ConfigLoader } from '../../src/config-loader';
import { registerModelSelect } from '../../src/extensions/model-select';
import { PI_VIM_KEY_EVENT_ID } from '../../src/extensions/model-select/constants';
import { ModelSelectModal } from '../../src/extensions/model-select/model-select-modal';
import { SubscriptionUsageCache } from '../../src/libs/subscription-usage';
import { ModelSelectConfigSchema } from '../../src/schemas/model-select.config.schema';

test('vim event and command mount the same sectioned modal; disabled events do not open', async () => {
  const sessions: Array<(event: unknown, ctx: ExtensionContext) => void> = [];
  let eventHandler: (() => void) | undefined;
  let commandHandler: ((args: string, ctx: ExtensionContext) => Promise<void>) | undefined;
  const opened: ModelSelectModal[] = [];
  const applied: unknown[] = [];
  let enabled = true;
  const pi = {
    on: (_name: string, handler: (event: unknown, ctx: ExtensionContext) => void) => sessions.push(handler),
    registerCommand: (_name: string, command: { handler: typeof commandHandler }) => { commandHandler = command.handler; },
    events: { on: (name: string, handler: () => void) => { expect(name).toBe(PI_VIM_KEY_EVENT_ID); eventHandler = handler; } },
    setModel: async (model: unknown) => { applied.push(model); return true; },
  } as unknown as ExtensionAPI;
  const theme = { fg: (_color: string, text: string) => text, bold: (text: string) => text } as Theme;
  const keys = { matches: () => false } as unknown as KeybindingsManager;
  const ctx = {
    hasUI: true,
    modelRegistry: { refresh: () => undefined, getAvailable: () => [], getError: () => undefined },
    ui: {
      notify: () => undefined,
      custom: async (factory: (tui: unknown, theme: Theme, keys: KeybindingsManager, done: (result: unknown) => void) => ModelSelectModal) => {
        let result: unknown;
        const modal = factory({ terminal: { rows: 24 }, requestRender: () => undefined }, theme, keys, value => { result = value; });
        opened.push(modal);
        expect(modal.activeSectionIndex).toBe(0);
        expect(modal.render(120)[0]).toContain('Usage');
        modal.handleInput('\x1d');
        modal.handleInput('q');
        return result;
      },
    },
  } as unknown as ExtensionContext;
  const config = {
    isEnabled: () => enabled,
    getModelSelect: () => ModelSelectConfigSchema.parse({ enabled: true }),
  } as unknown as ConfigLoader;
  registerModelSelect(pi, { config, usageCache: new SubscriptionUsageCache() });
  expect(eventHandler).toBeUndefined();
  sessions[0]?.({}, ctx);
  eventHandler?.();
  await Bun.sleep(0);
  expect(opened.length).toBe(1);
  await commandHandler?.('', ctx);
  expect(opened.length).toBe(2);
  expect(applied).toEqual([]);
  enabled = false;
  eventHandler?.();
  await Bun.sleep(0);
  expect(opened.length).toBe(2);
});
