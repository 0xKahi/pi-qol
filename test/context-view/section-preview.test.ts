import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Theme } from '@earendil-works/pi-coding-agent';
import { previewBodyLines, previewLegendLines } from '../../src/extensions/context-view/ui/section-preview.ts';

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

test('previewBodyLines drops a first line that repeats the heading above it', () => {
  assert.deepEqual(previewBodyLines(theme, { text: 'Skills:\nbody', jsonSpan: undefined }, 40, wrap, 'Skills'), ['    body']);
  assert.deepEqual(previewBodyLines(theme, { text: 'Kept:\nbody' }, 40, wrap, 'Other'), ['    Kept:', '    body']);
});

test('previewBodyLines restores injected references with their source, tool, and guess caveat', () => {
  const lines = previewBodyLines(
    theme,
    {
      text: 'Guidelines:',
      injectedReferences: [
        {
          offset: 'Guidelines:'.length,
          text: '\n- Use search',
          itemId: 'tool:search',
          source: { id: 'web', label: 'npm:web', native: false },
          tool: 'search',
          attribution: 'guess',
        },
      ],
    },
    120,
    () => {
      throw new Error('Referenced content must not route through the caller wrapText');
    },
  );

  const joined = lines.join('\n');
  assert.match(joined, /Guidelines:/);
  assert.ok(joined.includes('- Use search\u00A0<-\u00A0npm:web:search (guess)'));
});

test('previewLegendLines explains exactly the markers the preview renders', () => {
  const referenced = {
    text: 'Guidelines:',
    injectedReferences: [{ offset: 11, text: '\n- Use search', itemId: 'tool:search', source: { id: 'web', label: 'npm:web', native: false } }],
  };
  const layout = { width: 200, contentLineCount: 30, availableRows: 40 };

  const lines = previewLegendLines(theme, [referenced], layout);
  assert.equal(lines.length, 1);
  assert.match(lines[0] ?? '', /^ {2}- Highlighted parts are injected by extensions/);

  // A frame with no room collapses the whole legend rather than truncating it.
  assert.deepEqual(previewLegendLines(theme, [referenced], { ...layout, availableRows: 5 }), []);

  const dropped = previewLegendLines(theme, [{ text: 'x', dropped: true }], layout);
  assert.equal(dropped.length, 1);
  assert.match(dropped[0] ?? '', /^ {2}- Dropped parts were replaced/);

  const moved = previewLegendLines(theme, [{ text: 'x', moved: true }], layout);
  assert.match(moved[0] ?? '', /^ {2}- Moved blocks appear/);

  assert.deepEqual(previewLegendLines(theme, [{ text: 'plain' }], layout), []);
});
