import { expect, test } from 'bun:test';
import type { Theme } from '@earendil-works/pi-coding-agent';
import { visibleWidth } from '@earendil-works/pi-tui';
import { renderSectionRule, renderTabStrip } from '../../src/libs/modal';

const theme = { fg: (_color: string, text: string) => text, bold: (text: string) => text } as Theme;

test('section rules fit, overflow around the active label, and preserve corners', () => {
  expect(renderSectionRule(theme, ['One', 'Two'], 0, 30, 'inline')).toBe('── One ── Two ────────────────');
  for (const style of ['inline', 'bordered'] as const) {
    const line = renderSectionRule(theme, ['First long label', 'Active', 'Last long label'], 1, 20, style);
    expect(line).toContain('Active');
    expect(line).toContain('…');
    expect(visibleWidth(line)).toBe(20);
    if (style === 'bordered') expect(line).toMatch(/^╭.*╮$/);
    for (let width = 0; width < 40; width++) {
      expect(visibleWidth(renderSectionRule(theme, ['First', 'Active', 'Last'], 1, width, style))).toBeLessThanOrEqual(width);
    }
  }
  expect(renderSectionRule(theme, ['Long', 'Active', 'Last'], 1, 6, 'inline')).toBe('Active');
});

test('active labels are accent and bold, inactive labels muted, glyphs border styled', () => {
  const calls: string[] = [];
  const styled = {
    fg: (color: string, text: string) => { calls.push(`${color}:${text}`); return text; },
    bold: (text: string) => { calls.push(`bold:${text}`); return text; },
  } as Theme;
  renderSectionRule(styled, ['One', 'Two'], 1, 40, 'bordered');
  expect(calls).toContain('muted:One');
  expect(calls).toContain('bold:Two');
  expect(calls).toContain('accent:Two');
  expect(calls).toContain('border:╭');
});

test('tab windowing retains active labels and omissions', () => {
  expect(renderTabStrip(theme, ['One', 'Two'], 0, 40)).toBe('One  Two');
  expect(renderTabStrip(theme, ['Long first', 'Active', 'Long last'], 1, 16)).toContain('Active');
  expect(renderTabStrip(theme, ['Long first', 'Active', 'Long last'], 1, 16)).toContain('…');
});
