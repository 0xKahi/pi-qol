/** Shared rendering for preview content split into labeled measured sections. */
import type { Theme } from '@earendil-works/pi-coding-agent';
import { wrapTextWithAnsi } from '@earendil-works/pi-tui';
import { BODY_INDENT } from '../../../libs/modal';
import type { InjectionSection } from '../model';
import { normalizeInlineText } from './injections-model';

export interface SectionedContent {
  readonly text: string;
  readonly sections?: readonly InjectionSection[];
}

export function previewBodyLines(theme: Theme, content: SectionedContent, wrapWidth: number, wrapText: (text: string) => string[]): string[] {
  const sections = content.sections ?? [];
  if (sections.length === 0) return wrapText(content.text);
  const lines: string[] = [];
  for (const section of sections) {
    if (lines.length > 0) lines.push('');
    lines.push(...sectionHeaderLines(theme, section, wrapWidth));
    lines.push(...wrapText(section.text.replace(/^\n+/, '')));
  }
  return lines;
}

function sectionHeaderLines(theme: Theme, section: InjectionSection, wrapWidth: number): string[] {
  const label = theme.fg('syntaxFunction', theme.bold(normalizeInlineText(section.label)));
  const tokens = theme.fg('muted', ` · ${section.tokens.toLocaleString('en-US')} tokens`);
  return wrapTextWithAnsi(`${label}${tokens}`, wrapWidth).map(line => `${BODY_INDENT}${line}`);
}
