import { afterEach, describe, expect, test } from 'bun:test';
import { dye } from '@0xkahi/cli-dye';
import type { KeybindingsManager, Theme } from '@earendil-works/pi-coding-agent';
import { createUsageSection } from '../../src/extensions/model-select/usage-section';
import { UsageProviderTab } from '../../src/extensions/model-select/usage-section/usage-provider-tab';
import { SubscriptionUsageCache, type UsageCacheEntry, type UsageResult } from '../../src/libs/subscription-usage';

const now = 1_800_000_000_000;
afterEach(() => dye.setEnabled(undefined));
const theme = { fg: (_color: string, text: string) => text, bold: (text: string) => text } as Theme;
const keys = { matches: () => false } as unknown as KeybindingsManager;
const tui = { terminal: { rows: 24 }, requestRender: () => undefined };
const windows = [
  { label: '5h', usedPercent: 48, resetAt: new Date(now + (2 * 60 + 13) * 60000), windowSeconds: 18000 },
  { label: 'Week', usedPercent: 81, resetAt: new Date(now + (3 * 24 + 4) * 3600000), windowSeconds: 604800 },
  { label: 'Extra', usedPercent: 100, resetAt: new Date(now + 60000), windowSeconds: 18000 },
];
function cached(entry?: UsageCacheEntry): SubscriptionUsageCache {
  return { get: () => entry } as unknown as SubscriptionUsageCache;
}
function render(entry?: UsageCacheEntry): string {
  return new UsageProviderTab(theme, cached(entry), 'anthropic', 'Claude', () => now).render(160, undefined).join('\n');
}

describe('UsageProviderTab', () => {
  test('all windows, bars, reset times, pace, freshness and styling', () => {
    const calls: string[] = [];
    const styled = { ...theme, fg: (color: string, text: string) => { calls.push(`${color}:${text}`); return text; } } as Theme;
    const entry: UsageCacheEntry = { result: { status: 'ok', label: 'Claude', windows }, lastSuccess: { windows, fetchedAt: now - 42000 }, inFlight: false };
    const tab = new UsageProviderTab(styled, cached(entry), 'anthropic', 'Claude', () => now);
    const lines = tab.render(160, undefined);
    expect(lines[0]).toContain('updated 42s ago');
    expect(lines[1]).toBe('');
    expect(lines[2]).toContain('5h');
    expect(lines[2]).toContain('48% resets 2h13m on pace');
    expect(lines[3]).toBe('');
    expect(lines[4]).toContain('81% resets 3d4h ahead');
    expect(lines[5]).toBe('');
    expect(lines[6]).toContain('100%');
    expect(lines).toHaveLength(7);
    expect(lines.at(-1)).not.toBe('');
    expect(lines.join('\n')).toContain('█');
    expect(lines.join('\n')).toContain('░');
    expect(calls).toContain('warning:ahead');
    expect(calls).toContain('error:limit');
    expect(calls).toContain('muted:on pace');
    expect(calls.some(call => call.startsWith('dim:░'))).toBe(true);
    expect(calls).toContain('dim: resets 2h13m');
    tab.handleNavigation('step-forward');
    expect(tab.render(160, undefined)[4]).toMatch(/^→ Week/);
    tab.handleNavigation('last');
    expect(tab.render(160, undefined)[6]).toMatch(/^→ Extra/);
    tab.handleNavigation('first');
    expect(tab.render(160, undefined)[2]).toMatch(/^→ 5h/);
    expect(tab.hints()).toContainEqual(['r', 'Refresh']);
  });

  test('fixed provider colors match the footer', () => {
    dye.setEnabled(true);
    const entry: UsageCacheEntry = { result: { status: 'ok', label: 'Claude', windows }, inFlight: false };
    const calls: string[] = [];
    const styled = { ...theme, fg: (color: string, text: string) => { calls.push(`${color}:${text}`); return text; } } as Theme;
    const tab = new UsageProviderTab(styled, cached(entry), 'anthropic', 'Claude', () => now);
    const lines = tab.render(160, undefined);
    const colorize = (text: string) => dye.colorize(text, { fg: dye.hex('#D97706') });
    expect(lines[0]).toContain(colorize('Claude'));
    expect(lines[2]).toContain(colorize('5h   '));
    expect(lines[2]).toContain(colorize('█'.repeat(5)));
    expect(lines[2]).toContain(colorize('48%'));
    expect(calls).toContain('dim: resets 2h13m');
    expect(calls).toContain(`dim:${'░'.repeat(5)}`);
    const codex = new UsageProviderTab(theme, cached(entry), 'openai-codex', 'Codex', () => now);
    expect(codex.render(160, undefined)[0]).toContain(dye.colorize('Codex', { fg: dye.hex('#10B981') }));
    dye.setEnabled(false);
    expect(new UsageProviderTab(theme, cached(entry), 'anthropic', 'Claude', () => now).render(160, undefined).join('\n')).not.toContain('\x1b');
  });

  test('spaced rows scroll per window and always keep selection visible in bounded content', () => {
    const entry: UsageCacheEntry = { result: { status: 'ok', label: 'Claude', windows }, inFlight: false };
    for (const height of [1, 3, 4, 5, 6]) {
      const tab = new UsageProviderTab(theme, cached(entry), 'anthropic', 'Claude', () => now);
      tab.render(160, height);
      for (const [action, selected] of [['step-forward', 'Week'], ['last', 'Extra'], ['step-back', 'Week'], ['first', '5h']] as const) {
        tab.handleNavigation(action);
        const lines = tab.render(160, height);
        expect(lines.length).toBeLessThanOrEqual(height);
        expect(lines.join('\n')).toContain(`→ ${selected}`);
        expect(lines.at(-1)).not.toBe('');
      }
    }
    const tab = new UsageProviderTab(theme, cached(entry), 'anthropic', 'Claude', () => now);
    expect(tab.render(160, 5)[3]).toBe('');
    expect(tab.render(160, 5)[4]).toContain('Week');
    tab.handleNavigation('page-forward');
    expect(tab.render(160, 5).join('\n')).toContain('→ Week');
    tab.handleNavigation('page-back');
    expect(tab.render(160, 5).join('\n')).toContain('→ 5h');
  });

  test('render cache hits within a second and invalidates on ticks and in-flight changes', () => {
    let time = now;
    let styledCount = 0;
    const styled = { ...theme, bold: (text: string) => { styledCount++; return text; } } as Theme;
    const entry: UsageCacheEntry = { result: { status: 'ok', label: 'Claude', windows }, lastSuccess: { windows, fetchedAt: now }, inFlight: false };
    const tab = new UsageProviderTab(styled, cached(entry), 'anthropic', 'Claude', () => time);
    const initial = tab.render(160, undefined);
    time += 500;
    expect(tab.render(160, undefined)).toEqual(initial);
    expect(styledCount).toBe(1);
    time += 500;
    expect(tab.render(160, undefined)[0]).toContain('updated 1s ago');
    expect(styledCount).toBe(2);
    entry.inFlight = true;
    expect(tab.render(160, undefined)[0]).toContain('refreshing…');
    expect(styledCount).toBe(3);
    entry.inFlight = false;
    expect(tab.render(160, undefined)[0]).not.toContain('refreshing…');
  });

  test('explicit provider states, loading without an entry, and no windows without success', () => {
    expect(render()).toContain('loading');
    expect(render({ inFlight: true })).toContain('loading');
    const states: Array<[UsageResult, string]> = [
      [{ status: 'no-auth', label: 'Codex' }, 'not logged in'],
      [{ status: 'expired', label: 'Claude' }, 'auth expired, re-login'],
      [{ status: 'http-error', label: 'Claude', httpStatus: 500 }, 'request failed (HTTP 500)'],
      [{ status: 'network', label: 'Claude' }, 'network error'],
      [{ status: 'unavailable', label: 'Claude' }, 'no usage data'],
    ];
    for (const [result, message] of states) {
      const text = render({ result, inFlight: false });
      expect(text).toContain(message);
      expect(text).not.toContain('resets');
    }
  });

  test('failure preserves prior windows and original age, including minutes and hours', () => {
    for (const [age, expected] of [[42000, '42s'], [120000, '2m'], [7200000, '2h']] as const) {
      const text = render({ result: { status: 'network', label: 'Claude' }, lastSuccess: { windows, fetchedAt: now - age }, inFlight: false });
      expect(text).toContain('network error');
      expect(text).toContain(`updated ${expected} ago`);
      expect(text).toContain('48%');
      expect(text).toContain('81%');
    }
  });

  test('unknown reset and duration omit reset and pace', () => {
    const text = render({ result: { status: 'ok', label: 'Claude', windows: [{ label: 'Unknown', usedPercent: 12 }] }, inFlight: false });
    expect(text).toContain('12%');
    expect(text).not.toContain('resets');
    expect(text).not.toContain('pace');
  });
});

test('provider preselection and provider tab cycling, with no filter and q dismissal', () => {
  for (const [provider, index] of [['openai-codex', 1], ['unsupported', 0]] as const) {
    const results: unknown[] = [];
    const section = createUsageSection(tui as never, theme, keys, { cache: cached(), currentProvider: provider, onDone: result => results.push(result) });
    expect(section.dialog.activeIndex).toBe(index);
    expect(section.dialog.activeTab.label).toBe(index === 1 ? '[Codex]' : '[Claude]');
    expect(section.dialog.render(100)[0]).toContain('[Claude]');
    expect(section.dialog.render(100)[0]).toContain('[Codex]');
    expect(section.dialog.render(100).join('\n')).not.toContain('Filter:');
    section.dialog.handleInput('\t');
    expect(section.dialog.activeIndex).toBe(1 - index);
    section.dialog.handleInput('\x1b[Z');
    expect(section.dialog.activeIndex).toBe(index);
    section.dialog.handleInput('q');
    expect(results).toEqual([null]);
  }
});

test('activation reuses TTL cache and raw r forces only the active provider refresh', async () => {
  const calls: string[] = [];
  const cache = new SubscriptionUsageCache({ now: () => now, api: { fetchUsage: async strategy => { calls.push(strategy.provider); return { status: 'ok', label: strategy.label, windows }; } } });
  const section = createUsageSection(tui as never, theme, keys, { cache, onDone: () => undefined, now: () => now });
  expect(calls).toEqual([]);
  section.onActivate?.();
  await Bun.sleep(0);
  expect(calls).toEqual(['anthropic', 'openai-codex']);
  section.onActivate?.();
  await Bun.sleep(0);
  expect(calls.length).toBe(2);
  section.dialog.handleInput('r');
  const refreshing = section.dialog.render(160).join('\n');
  expect(refreshing).toContain('refreshing…');
  expect(refreshing).toContain('48%');
  expect(refreshing).toContain('81%');
  await Bun.sleep(0);
  expect(calls).toEqual(['anthropic', 'openai-codex', 'anthropic']);
  expect(section.dialog.render(160).join('\n')).toContain('updated 0s ago');
  expect(section.dialog.render(160).join('\n')).not.toContain('refreshing…');
});
