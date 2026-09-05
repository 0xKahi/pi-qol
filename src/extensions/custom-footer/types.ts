import type { ExtensionContext } from '@earendil-works/pi-coding-agent';
import type { TUI } from '@earendil-works/pi-tui';
import type { ConfigLoader } from '../../config-loader';
import type { Config } from '../../schemas/config.schema';
import type { AgentDisplayState } from './agent-display-state';

export type SupportedProvider = 'anthropic' | 'openai-codex';

export type CustomFooterConfig = Config['custom_footer'];
export type CustomFooterColors = CustomFooterConfig['colors'];
export type CustomFooterDisplay = CustomFooterConfig['display'];
export type CustomFooterIcons = CustomFooterConfig['icons'];

export type FooterTheme = {
  fg(color: 'accent' | 'dim' | 'error' | 'warning', text: string): string;
};

export type FooterDataProvider = {
  getGitBranch(): string | null;
  getExtensionStatuses(): ReadonlyMap<string, string>;
  getAvailableProviderCount(): number;
  onBranchChange(cb: () => void): () => void;
};

export type CustomFooterComponentDeps = {
  tui: TUI;
  theme: FooterTheme;
  footerData: FooterDataProvider;
  ctx: ExtensionContext;
  config: ConfigLoader;
  agentDisplayState: AgentDisplayState;
  getThinkingLevel: () => string;
};

export type UsageTotals = {
  totalInput: number;
  totalOutput: number;
  totalCacheRead: number;
  totalCacheWrite: number;
  totalCost: number;
  latestCacheHitRate?: number;
};
