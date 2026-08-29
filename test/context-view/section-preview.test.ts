import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Theme } from '@earendil-works/pi-coding-agent';
import { previewBodyLines } from '../../src/extensions/context-view/ui/section-preview.ts';

const theme = {
  fg: (_color: string, text: string) => text,
  bold: (text: string) => text,
} as Theme;
const wrap = (text: string) => text.split('\n').map(line => `    ${line}`);

test('previewBodyLines labels measured tool sections and their tokens', () => {
  const lines = previewBodyLines(
    theme,
    {
      text: '\n- search: Search\n- Cite sourcessearch: Search\n{}',
      sections: [
        { label: 'Prompt Snippet', text: '\n- search: Search', tokens: 5 },
        { label: 'Guidelines', text: '\n- Cite sources', tokens: 4 },
        { label: 'Definition', text: 'search: Search\n{}', tokens: 5 },
      ],
    },
    80,
    wrap,
  );
  assert.match(lines.join('\n'), /Prompt Snippet · 5 tokens/);
  assert.match(lines.join('\n'), /Guidelines · 4 tokens/);
  assert.match(lines.join('\n'), /Definition · 5 tokens/);
});

test('previewBodyLines falls back to unsectioned content', () => {
  assert.deepEqual(previewBodyLines(theme, { text: 'plain\ntext' }, 80, wrap), ['    plain', '    text']);
});
