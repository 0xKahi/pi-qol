import { describe, expect, test } from 'bun:test';
import type { ContextUsage, SessionEntry } from '@earendil-works/pi-coding-agent';
import { EMPTY_BAR_ICON, FILLED_BAR_ICON } from '../../src/extensions/custom-footer/constants';
import {
  buildStatsLeft,
  buildSubscriptionUsageSegment,
  calculateUsageTotals,
  formatTokens,
} from '../../src/extensions/custom-footer/token-stats';
import type { CustomFooterColors, CustomFooterIcons, FooterTheme, UsageTotals } from '../../src/extensions/custom-footer/types';
import { crayon } from '../../src/utils/crayon.util';

const identityTheme: FooterTheme = {
  fg: (_color, text) => text,
};

const taggedTheme: FooterTheme = {
  fg: (color, text) => `<${color}>${text}</${color}>`,
};

const icons: CustomFooterIcons = {
  directory: ' ',
  refresh: '',
  cache: 'C ',
  cacheRead: 'R ',
  cacheWrite: 'W ',
};

const colors: CustomFooterColors = {
  anthropicUsage: '#D97706',
  codexUsage: '#10B981',
};

function context(percent: number | null, contextWindow = 128_000): ContextUsage {
  return {
    tokens: percent === null ? null : 1000,
    contextWindow,
    percent,
  };
}

function stats(overrides: Partial<UsageTotals> = {}): UsageTotals {
  return {
    totalInput: 0,
    totalOutput: 0,
    totalCacheRead: 0,
    totalCacheWrite: 0,
    totalCost: 0,
    ...overrides,
  };
}

function assistantEntry(usage: {
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
  cost: number;
}): SessionEntry {
  return {
    type: 'message',
    id: 'assistant-entry',
    parentId: null,
    timestamp: '2026-01-01T00:00:00.000Z',
    message: {
      role: 'assistant',
      content: [],
      api: 'test-api',
      provider: 'test-provider',
      model: 'test-model',
      timestamp: Date.now(),
      stopReason: 'stop',
      usage: {
        input: usage.input,
        output: usage.output,
        cacheRead: usage.cacheRead,
        cacheWrite: usage.cacheWrite,
        totalTokens: usage.input + usage.output + usage.cacheRead + usage.cacheWrite,
        cost: {
          input: 0,
          output: 0,
          cacheRead: 0,
          cacheWrite: 0,
          total: usage.cost,
        },
      },
    },
  } as SessionEntry;
}

describe('custom-footer token stats', () => {
  test('formatTokens matches pi footer thresholds', () => {
    expect(formatTokens(999)).toBe('999');
    expect(formatTokens(1000)).toBe('1.0k');
    expect(formatTokens(1500)).toBe('1.5k');
    expect(formatTokens(10_000)).toBe('10k');
    expect(formatTokens(999_999)).toBe('1000k');
    expect(formatTokens(1_500_000)).toBe('1.5M');
    expect(formatTokens(12_000_000)).toBe('12M');
  });

  test('calculateUsageTotals sums assistant usage and tracks latest cache hit rate', () => {
    const userEntry = {
      type: 'message',
      id: 'user-entry',
      parentId: null,
      timestamp: '2026-01-01T00:00:00.000Z',
      message: { role: 'user', content: 'hello', timestamp: Date.now() },
    } as SessionEntry;

    expect(
      calculateUsageTotals([
        assistantEntry({ input: 100, output: 20, cacheRead: 10, cacheWrite: 5, cost: 0.001 }),
        userEntry,
        assistantEntry({ input: 50, output: 30, cacheRead: 25, cacheWrite: 25, cost: 0.002 }),
      ]),
    ).toEqual({
      totalInput: 150,
      totalOutput: 50,
      totalCacheRead: 35,
      totalCacheWrite: 30,
      totalCost: 0.003,
      latestCacheHitRate: 25,
    });
  });

  test('buildStatsLeft assembles tokens, cache cluster, cost, and context', () => {
    expect(
      buildStatsLeft({
        totals: stats({
          totalInput: 1500,
          totalOutput: 2000,
          totalCacheRead: 3000,
          totalCacheWrite: 4000,
          totalCost: 0.1234,
          latestCacheHitRate: 42.123,
        }),
        display: { tokens: true, cache: true },
        icons,
        contextUsage: context(50.123),
        contextWindow: 128_000,
        usingSubscription: false,
        theme: identityTheme,
      }),
    ).toBe('↑1.5k ↓2.0k C [R 3.0k W 4.0k 42.1%] $0.123 50.1%/128k');
  });

  test('buildStatsLeft respects token/cache display toggles and subscription cost indicator', () => {
    expect(
      buildStatsLeft({
        totals: stats({ totalInput: 1500, totalOutput: 2000, totalCacheRead: 3000, totalCacheWrite: 4000 }),
        display: { tokens: false, cache: false },
        icons,
        contextUsage: context(null, 200_000),
        contextWindow: 200_000,
        usingSubscription: true,
        theme: identityTheme,
      }),
    ).toBe('$0.000 (sub) ?/200k');
  });

  test('buildStatsLeft renders cache cluster only for cache activity and omits unknown hit rate', () => {
    expect(
      buildStatsLeft({
        totals: stats({ totalCacheWrite: 100 }),
        display: { tokens: true, cache: true },
        icons,
        contextUsage: context(1, 1000),
        contextWindow: 1000,
        usingSubscription: false,
        theme: identityTheme,
      }),
    ).toBe('C [R 0 W 100] 1.0%/1.0k');
  });

  test('buildStatsLeft colors high context usage and appends subscription usage', () => {
    expect(
      buildStatsLeft({
        totals: stats(),
        display: { tokens: true, cache: true },
        icons,
        contextUsage: context(75),
        contextWindow: 128_000,
        usingSubscription: false,
        subscriptionUsageSegment: 'SUB',
        theme: taggedTheme,
      }),
    ).toBe('<warning>75.0%/128k</warning> <dim>•</dim> SUB');

    expect(
      buildStatsLeft({
        totals: stats(),
        display: { tokens: true, cache: true },
        icons,
        contextUsage: context(95),
        contextWindow: 128_000,
        usingSubscription: false,
        theme: taggedTheme,
      }),
    ).toBe('<error>95.0%/128k</error>');
  });

  test('buildSubscriptionUsageSegment renders colored provider usage with progress bar and reset', () => {
    const segment = buildSubscriptionUsageSegment({
      colors,
      icons,
      theme: identityTheme,
      usage: {
        provider: 'anthropic',
        responseLabel: 'Claude',
        windowLabel: '5h',
        usedPercent: 49.6,
        resetDescription: '45m',
      },
    });

    expect(crayon.stripAnsi(segment)).toBe(`Claude 5h ${FILLED_BAR_ICON.repeat(5)}${EMPTY_BAR_ICON.repeat(5)} 50%  45m`);
  });

  test('buildSubscriptionUsageSegment omits refresh cluster without reset description', () => {
    const segment = buildSubscriptionUsageSegment({
      colors,
      icons,
      theme: identityTheme,
      usage: {
        provider: 'openai-codex',
        responseLabel: 'Codex',
        windowLabel: 'Week',
        usedPercent: 1000,
      },
    });

    expect(crayon.stripAnsi(segment)).toBe(`Codex Week ${FILLED_BAR_ICON.repeat(10)} 100%`);
  });
});
