import { dye } from '@0xkahi/cli-dye';
import type { ContextUsage, SessionEntry } from '@earendil-works/pi-coding-agent';
import { clampPercent, renderProgressBar } from './progress-bar';
import type { CustomFooterColors, CustomFooterDisplay, CustomFooterIcons, FooterTheme, SupportedProvider, UsageTotals } from './types';

export type SubscriptionUsageSegmentInput = {
  provider: SupportedProvider;
  responseLabel: string;
  windowLabel: string;
  usedPercent: number;
  resetDescription?: string;
};

export type BuildStatsLeftOptions = {
  totals: UsageTotals;
  display: CustomFooterDisplay;
  icons: Pick<CustomFooterIcons, 'cache' | 'cacheRead' | 'cacheWrite'>;
  contextUsage: ContextUsage | undefined;
  contextWindow: number;
  usingSubscription: boolean;
  subscriptionUsageSegment?: string;
  theme: FooterTheme;
};

export function formatTokens(count: number): string {
  if (count < 1000) return count.toString();
  if (count < 10000) return `${(count / 1000).toFixed(1)}k`;
  if (count < 1000000) return `${Math.round(count / 1000)}k`;
  if (count < 10000000) return `${(count / 1000000).toFixed(1)}M`;
  return `${Math.round(count / 1000000)}M`;
}

export function calculateUsageTotals(entries: readonly SessionEntry[]): UsageTotals {
  const totals: UsageTotals = {
    totalInput: 0,
    totalOutput: 0,
    totalCacheRead: 0,
    totalCacheWrite: 0,
    totalCost: 0,
  };

  for (const entry of entries) {
    if (entry.type !== 'message' || entry.message.role !== 'assistant') continue;

    const usage = entry.message.usage;
    totals.totalInput += usage.input;
    totals.totalOutput += usage.output;
    totals.totalCacheRead += usage.cacheRead;
    totals.totalCacheWrite += usage.cacheWrite;
    totals.totalCost += usage.cost.total;

    const latestPromptTokens = usage.input + usage.cacheRead + usage.cacheWrite;
    totals.latestCacheHitRate = latestPromptTokens > 0 ? (usage.cacheRead / latestPromptTokens) * 100 : undefined;
  }

  return totals;
}

export function buildSubscriptionUsageSegment({
  colors,
  icons,
  theme,
  usage,
}: {
  colors: Pick<CustomFooterColors, 'anthropicUsage' | 'codexUsage'>;
  icons: Pick<CustomFooterIcons, 'refresh'>;
  theme: FooterTheme;
  usage: SubscriptionUsageSegmentInput;
}): string {
  const providerColor = usage.provider === 'anthropic' ? colors.anthropicUsage : colors.codexUsage;
  const pct = clampPercent(usage.usedPercent);
  const roundedPercent = Math.round(pct).toString();
  const bar = renderProgressBar(pct);
  const foreground = dye.hex(providerColor);

  const resetParts = usage.resetDescription ? [icons.refresh, usage.resetDescription].filter(Boolean).join(' ') : '';

  return [
    dye.colorize(usage.responseLabel, { fg: foreground }),
    dye.colorize(usage.windowLabel, { fg: foreground }),
    `${dye.colorize(bar.filled, { fg: foreground })}${theme.fg('dim', bar.empty)}`,
    dye.colorize(`${roundedPercent}%`, { fg: foreground }),
    resetParts ? theme.fg('dim', resetParts) : undefined,
  ]
    .filter((part): part is string => Boolean(part))
    .join(' ');
}

export function buildStatsLeft({
  contextUsage,
  contextWindow,
  display,
  icons,
  subscriptionUsageSegment,
  theme,
  totals,
  usingSubscription,
}: BuildStatsLeftOptions): string {
  const parts: string[] = [];

  if (display.tokens) {
    if (totals.totalInput) parts.push(theme.fg('dim', `↑${formatTokens(totals.totalInput)}`));
    if (totals.totalOutput) parts.push(theme.fg('dim', `↓${formatTokens(totals.totalOutput)}`));
  }

  if (display.cache && (totals.totalCacheRead > 0 || totals.totalCacheWrite > 0)) {
    const hitRate = totals.latestCacheHitRate !== undefined ? ` ${totals.latestCacheHitRate.toFixed(1)}%` : '';
    parts.push(
      theme.fg(
        'dim',
        `${icons.cache}[${icons.cacheRead}${formatTokens(totals.totalCacheRead)} ${icons.cacheWrite}${formatTokens(totals.totalCacheWrite)}${hitRate}]`,
      ),
    );
  }

  if (totals.totalCost || usingSubscription) {
    parts.push(theme.fg('dim', `$${totals.totalCost.toFixed(3)}${usingSubscription ? ' (sub)' : ''}`));
  }

  parts.push(buildContextUsageSegment({ contextUsage, contextWindow, theme }));

  if (subscriptionUsageSegment) {
    parts.push(theme.fg('dim', '•'), subscriptionUsageSegment);
  }

  return parts.join(' ');
}

function buildContextUsageSegment({
  contextUsage,
  contextWindow,
  theme,
}: {
  contextUsage: ContextUsage | undefined;
  contextWindow: number;
  theme: FooterTheme;
}): string {
  const contextPercentValue = contextUsage?.percent ?? 0;
  const contextPercent = contextUsage?.percent !== null ? contextPercentValue.toFixed(1) : '?';
  const contextPercentDisplay = contextPercent === '?' ? `?/${formatTokens(contextWindow)}` : `${contextPercent}%/${formatTokens(contextWindow)}`;

  if (contextPercentValue > 90) return theme.fg('error', contextPercentDisplay);
  if (contextPercentValue > 70) return theme.fg('warning', contextPercentDisplay);
  return theme.fg('dim', contextPercentDisplay);
}
