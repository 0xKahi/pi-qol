import type { KeybindingsManager, Theme } from '@earendil-works/pi-coding-agent';
import type { TUI } from '@earendil-works/pi-tui';
import { ModalDialog, type ModalSection, VimNavigationScheme } from '../../../libs/modal';
import { resolveSupportedProvider, SUBSCRIPTION_PROVIDERS, type SubscriptionUsageCache } from '../../../libs/subscription-usage';
import type { DialogResult } from '../types';
import { UsageProviderTab } from './usage-provider-tab';

export function createUsageSection(
  tui: TUI,
  theme: Theme,
  keybindings: KeybindingsManager,
  options: {
    cache: SubscriptionUsageCache;
    currentProvider?: string;
    onDone: (result: DialogResult) => void;
    now?: () => number;
  },
): ModalSection<DialogResult> {
  const provider = resolveSupportedProvider(options.currentProvider);
  return {
    label: 'Usage',
    dialog: new ModalDialog<DialogResult>(tui, theme, keybindings, {
      tabs: SUBSCRIPTION_PROVIDERS.map(entry => new UsageProviderTab(theme, options.cache, entry.provider, entry.label, options.now)),
      initialTabIndex: Math.max(
        0,
        SUBSCRIPTION_PROVIDERS.findIndex(entry => entry.provider === provider),
      ),
      navigation: new VimNavigationScheme(),
      frame: 'none',
      cancelValue: null,
      onComplete: options.onDone,
    }),
    onActivate: () => {
      for (const entry of SUBSCRIPTION_PROVIDERS) options.cache.ensureFresh(entry.provider);
    },
  };
}
