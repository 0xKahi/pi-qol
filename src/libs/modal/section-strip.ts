import type { Theme } from '@earendil-works/pi-coding-agent';
import { truncateToWidth, visibleWidth } from '@earendil-works/pi-tui';
import { labelWindow } from './label-window';

/** Render section labels inside the frame's top rule without adding height. */
export function renderSectionRule(theme: Theme, labels: string[], activeIndex: number, width: number, style: 'inline' | 'bordered'): string {
  const safeWidth = Math.max(0, Math.floor(width));
  const border = (text: string) => theme.fg('border', text);
  const bordered = style === 'bordered' && safeWidth >= 2;
  const inner = safeWidth - (bordered ? 2 : 0);
  const separator = bordered ? ' ─ ' : ' ── ';
  const prefix = bordered ? '─ ' : '── ';
  const budget = Math.max(0, inner - visibleWidth(prefix) - 1);
  const { start, end } = labelWindow(labels, activeIndex, budget, separator);
  const parts: string[] = [];
  if (start > 0) parts.push(theme.fg('muted', '…'));
  for (let index = start; index <= end; index++) {
    const label = labels[index] ?? '';
    parts.push(index === activeIndex ? theme.fg('accent', theme.bold(label)) : theme.fg('muted', label));
  }
  if (end < labels.length - 1) parts.push(theme.fg('muted', '…'));
  let strip = parts.join(border(separator));
  let body: string;
  if (visibleWidth(strip) > budget) {
    const active = truncateToWidth(labels[activeIndex] ?? '', inner, '');
    strip = theme.fg('accent', theme.bold(active));
    body = strip;
  } else {
    body = border(prefix) + strip + border(' ');
  }
  body += border('─'.repeat(Math.max(0, inner - visibleWidth(body))));
  return bordered ? border('╭') + body + border('╮') : body;
}
