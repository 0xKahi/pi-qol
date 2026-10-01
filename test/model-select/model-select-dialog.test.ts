import { describe, expect, test } from 'bun:test';
import type { Api, Model } from '@earendil-works/pi-ai';
import type { KeybindingsManager, Theme } from '@earendil-works/pi-coding-agent';
import { visibleWidth } from '@earendil-works/pi-tui';
import { ModelFormatter } from '../../src/extensions/model-select/model-formatter';
import { ModelSelectModal } from '../../src/extensions/model-select/model-select-modal';
import { SubscriptionUsageCache } from '../../src/libs/subscription-usage';
import type { DialogOptions, ModelGroupList, ModelItem } from '../../src/extensions/model-select/types';

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

function item(id: string, provider = 'test'): ModelItem {
  return ModelFormatter.toModelItem(model(provider, id));
}

const theme = {
  fg: (_color: string, text: string) => text,
  bold: (text: string) => text,
} as Theme;

const keybindings = {
  matches: (data: string, action: string) =>
    ({ tab: 'tui.input.tab', up: 'tui.select.up', down: 'tui.select.down', enter: 'tui.select.confirm', esc: 'tui.select.cancel' })[data] === action,
} as unknown as KeybindingsManager;

function createDialog(
  overrides: Partial<DialogOptions> = {},
  onDone: (result: Model<Api> | null) => void = () => undefined,
  usageCache = new SubscriptionUsageCache(),
): ModelSelectModal {
  return new ModelSelectModal({ terminal: { rows: 24 }, requestRender: () => undefined } as never, theme, keybindings, {
    currentModel: undefined,
    favouriteItems: [],
    favouriteLabel: 'Favourites',
    favouriteWarnings: [],
    groupLists: [],
    searchItems: [],
    hideGroupTabs: false,
    hideSearchTab: false,
    providerFilter: [],
    configWarnings: [],
    initialSearch: '',
    onDone,
    ...overrides,
    usageCache,
    frame: overrides.frame === 'bordered' ? 'bordered' : 'inline',
  });
}

function tabLine(dialog: ModelSelectModal, width = 200): string {
  return dialog.render(width)[2] ?? '';
}

function groups(...entries: Array<[string, ModelItem[]]>): ModelGroupList[] {
  return entries.map(([name, items]) => ({ name, items }));
}

describe('model-select dialog', () => {
  test('opens on Select Model without fetching; query and confirmation survive visiting Usage', async () => {
    const calls: string[] = [];
    const cache = new SubscriptionUsageCache({ api: { fetchUsage: async strategy => {
      calls.push(strategy.provider);
      return { status: 'no-auth', label: strategy.label };
    } } });
    const chosen = item('claude');
    const selected: Array<Model<Api> | null> = [];
    const dialog = createDialog({ favouriteItems: [chosen], searchItems: [chosen], initialSearch: 'cla' }, result => selected.push(result), cache);
    expect(dialog.activeSectionIndex).toBe(0);
    expect(dialog.render(120)[0]).toContain('Select Model');
    expect(dialog.render(120)[0]).toContain('Usage');
    await Bun.sleep(0);
    expect(calls).toEqual([]);
    dialog.handleInput('\x1d');
    expect(dialog.activeSectionIndex).toBe(1);
    await Bun.sleep(0);
    expect(calls).toEqual(['anthropic', 'openai-codex']);
    dialog.handleInput('\x1d');
    expect(dialog.render(120).join('\n')).toContain('claude');
    dialog.handleInput('enter');
    expect(selected).toEqual([chosen.model]);
  });

  test('confirming without visiting Usage makes no requests', async () => {
    let requests = 0;
    const cache = new SubscriptionUsageCache({ api: { fetchUsage: async strategy => {
      requests++;
      return { status: 'no-auth', label: strategy.label };
    } } });
    const selected: Array<Model<Api> | null> = [];
    const chosen = item('alpha');
    const dialog = createDialog({ favouriteItems: [chosen] }, result => selected.push(result), cache);
    dialog.handleInput('enter');
    await Bun.sleep(0);
    expect(requests).toBe(0);
    expect(selected).toEqual([chosen.model]);
  });

  test('q filters Select Model but dismisses Usage; Esc dismisses Usage too', () => {
    const selected: Array<Model<Api> | null> = [];
    const dialog = createDialog({ favouriteItems: [item('qwen'), item('alpha')] }, result => selected.push(result));
    dialog.handleInput('q');
    expect(dialog.render(120).join('\n')).toContain('qwen');
    expect(dialog.render(120).join('\n')).not.toContain('→ alpha');
    expect(selected).toEqual([]);
    dialog.handleInput('\x1d');
    expect(dialog.render(120).join('\n')).toContain('r Refresh');
    dialog.handleInput('q');
    expect(selected).toEqual([null]);
    const escaped = createDialog({}, result => selected.push(result));
    escaped.handleInput('\x1d');
    escaped.handleInput('\x1b');
    expect(selected).toEqual([null, null]);
  });

  test('one-second ticks render only Usage and cleanup is idempotent after dispose or done', () => {
    for (const finish of ['dispose', 'done'] as const) {
      let tick: (() => void) | undefined;
      let listener: (() => void) | undefined;
      let renders = 0;
      let cancelled = 0;
      let unsubscribed = 0;
      const results: Array<Model<Api> | null> = [];
      const cache = {
        get: () => undefined,
        ensureFresh: () => undefined,
        subscribe: (fn: () => void) => {
          listener = fn;
          return () => { unsubscribed++; listener = undefined; };
        },
      } as unknown as SubscriptionUsageCache;
      const modal = new ModelSelectModal({ terminal: { rows: 24 }, requestRender: () => renders++ } as never, theme, keybindings, {
        currentModel: undefined, favouriteItems: [], favouriteLabel: 'Favourites', favouriteWarnings: [], groupLists: [], searchItems: [],
        hideGroupTabs: false, hideSearchTab: false, providerFilter: [], configWarnings: [], initialSearch: '', frame: 'inline', usageCache: cache,
        onDone: result => results.push(result),
        scheduleTick: (callback, intervalMs) => {
          expect(intervalMs).toBe(1000);
          expect(tick).toBeUndefined();
          tick = callback;
          return () => { cancelled++; };
        },
      });
      tick?.();
      expect(renders).toBe(0);
      modal.handleInput('\x1d');
      const beforeTick = renders;
      tick?.();
      expect(renders).toBe(beforeTick + 1);
      modal.handleInput('\x1d');
      const inactiveRenders = renders;
      tick?.();
      expect(renders).toBe(inactiveRenders);
      modal.handleInput('\x1d');
      const lateListener = listener;
      if (finish === 'dispose') modal.dispose();
      else modal.handleInput('q');
      const closedRenders = renders;
      expect(listener).toBeUndefined();
      modal.dispose();
      modal.dispose();
      tick?.();
      lateListener?.();
      expect(renders).toBe(closedRenders);
      expect(cancelled).toBe(1);
      expect(unsubscribed).toBe(1);
      expect(results).toEqual(finish === 'done' ? [null] : []);
    }
  });

  test('cache updates request renders and completion unsubscribes', () => {
    let listener: (() => void) | undefined;
    let renders = 0;
    const cache = { subscribe: (fn: () => void) => {
      listener = fn;
      return () => { listener = undefined; };
    } } as unknown as SubscriptionUsageCache;
    const dialog = new ModelSelectModal({ terminal: { rows: 24 }, requestRender: () => renders++ } as never, theme, keybindings, {
      currentModel: undefined, favouriteItems: [], favouriteLabel: 'Favourites', favouriteWarnings: [], groupLists: [], searchItems: [],
      hideGroupTabs: false, hideSearchTab: false, providerFilter: [], configWarnings: [], initialSearch: '', frame: 'inline', usageCache: cache,
      onDone: () => undefined,
    });
    listener?.();
    expect(renders).toBe(1);
    dialog.handleInput('esc');
    expect(listener).toBeUndefined();
  });
  test('uses the presenter-resolved frame for overlay presentation', () => {
    const dialog = createDialog({ frame: 'bordered' });
    expect(dialog.render(40)[0]).toMatch(/^╭.*Select Model.*Usage.*╮$/);
    expect(dialog.render(40).at(-1)).toMatch(/^╰─+╯$/);
  });

  test('renders configured default reasoning in the title and omits it when unset', () => {
    expect(createDialog({ defaultReasoning: 'high' }).render(100)[1]).toContain('reasoning: high');
    expect(createDialog().render(100)[1]).not.toContain('reasoning:');
  });

  test('renders a custom permanent label without label identity collisions', () => {
    const dialog = createDialog({
      favouriteLabel: 'Search',
      groupLists: groups(['Search', []], ['work', []]),
    });

    expect(tabLine(dialog).trim()).toBe('[Search 0]  [Search 0]  [work 0]  [Search 0]');
    expect(dialog.render(100).join('\n')).not.toContain('Provider filter:');

    dialog.handleInput('\x1b[Z');
    expect(dialog.render(100).join('\n')).toContain('Provider filter:');
  });

  test('keeps empty Favourites as the sole tab when optional tabs are hidden', () => {
    const dialog = createDialog({
      groupLists: groups(['work', []]),
      hideGroupTabs: true,
      hideSearchTab: true,
    });
    const rendered = dialog.render(100).join('\n');

    expect(tabLine(dialog).trim()).toBe('[Favourites 0]');
    expect(rendered).toContain('No configured favourites are available.');
    expect(rendered).not.toContain('Tab Switch');
  });

  test('uses Search for an initial query when visible and Favourites when Search is hidden', () => {
    const favourite = item('claude');
    const visibleSearch = createDialog({ favouriteItems: [favourite], searchItems: [favourite], initialSearch: 'cla' });
    const hiddenSearch = createDialog({ favouriteItems: [favourite], searchItems: [favourite], hideSearchTab: true, initialSearch: 'cla' });

    expect(visibleSearch.render(100).join('\n')).toContain('Provider filter:');
    expect(hiddenSearch.render(100).join('\n')).not.toContain('Provider filter:');
    expect(hiddenSearch.render(100).join('\n')).toContain('claude');
  });

  test('cycles visible tabs in both directions with wrapping and retains independent selection indices', () => {
    const alpha = item('alpha');
    const beta = item('beta');
    const selected: Array<Model<Api> | null> = [];
    const dialog = createDialog(
      {
        favouriteItems: [alpha, beta],
        groupLists: groups(['work', [alpha, beta]]),
        hideSearchTab: true,
      },
      result => selected.push(result),
    );

    dialog.handleInput('down');
    dialog.handleInput('tab');
    dialog.handleInput('enter');
    dialog.handleInput('\x1b[Z');
    dialog.handleInput('enter');
    dialog.handleInput('\x1b[Z');
    dialog.handleInput('enter');

    expect(selected.map(result => result?.id)).toEqual(['alpha', 'beta', 'alpha']);
    expect(dialog.render(100).join('\n')).toContain('Tab Switch');
  });

  test('applies one input query across favourites, groups, and Search', () => {
    const alpha = item('alpha');
    const zeta = item('zeta');
    const dialog = createDialog({
      favouriteItems: [alpha, zeta],
      groupLists: groups(['work', [alpha, zeta]]),
      searchItems: [alpha, zeta],
    });

    dialog.handleInput('z');
    expect(dialog.render(100).join('\n')).toContain('zeta');
    expect(dialog.render(100).join('\n')).not.toContain('→ alpha');

    dialog.handleInput('tab');
    expect(dialog.render(100).join('\n')).toContain('zeta');
    dialog.handleInput('\x1b[Z');
    expect(dialog.render(100).join('\n')).toContain('zeta');
  });

  test('keeps the active tab represented with omission markers at constrained widths', () => {
    const dialog = createDialog({
      groupLists: groups(['one', []], ['two', []], ['three', []], ['four', []], ['five', []]),
    });

    for (let index = 0; index < 4; index++) dialog.handleInput('tab');
    const rendered = dialog.render(22);

    expect(rendered.every(line => visibleWidth(line) <= 22)).toBe(true);
    expect(tabLine(dialog, 22)).toContain('four');
    expect(tabLine(dialog, 22)).toContain('…');
  });
});
