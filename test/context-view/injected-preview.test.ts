import assert from 'node:assert/strict';
import { test } from 'node:test';

import type { Theme } from '@earendil-works/pi-coding-agent';
import { visibleWidth } from '@earendil-works/pi-tui';

import { previewBodyLines } from '../../src/extensions/context-view/ui/section-preview.ts';

const theme = {
  fg: (_color: string, text: string) => text,
  bold: (text: string) => text,
} as Theme;

/** Remove any SGR styling so assertions see the raw visual columns. */
function plain(lines: readonly string[]): string {
  // biome-ignore lint/suspicious/noControlCharactersInRegex: tests strip terminal SGR sequences.
  return lines.join('\n').replace(/\u001b\[[\d;]*m/g, '');
}

test('reference text and source are sanitized before coloring and wrapping', () => {
  const lines = previewBodyLines(
    theme,
    {
      text: 'Guidelines:\n- Native rule',
      injectedReferences: [
        {
          offset: 'Guidelines:'.length,
          text: '\n- A\u001b[2JB\u001b]52;c;clipboard-secret\u0007\n  continuation\t界',
          itemId: 'tool:unsafe',
          source: { id: 'unsafe', label: 'npm:\u001b[31mweb\u001b[0m\r\nowner', native: false },
          tool: 'sea\u001b[31mrch\u0007',
        },
      ],
    },
    28,
    () => {
      throw new Error('Referenced content must sanitize before adding theme colors');
    },
  );

  // biome-ignore lint/suspicious/noControlCharactersInRegex: asserts terminal controls were stripped.
  assert.doesNotMatch(plain(lines), /\u001b|clipboard-secret|\t|\r/);
  assert.match(plain(lines), /- AB/);
  assert.match(plain(lines), /npm:web owner:search/);
  assert.ok(lines.every(line => visibleWidth(line) <= 30));
  const continuation = lines.find(line => line.includes('continuation'));
  assert.ok(continuation !== undefined);
});

test('references inside a preview section render their own attribution', () => {
  const lines = previewBodyLines(
    theme,
    {
      text: 'System Prompt',
      sections: [
        {
          label: 'Prompt Snippet',
          text: '\n- Use search',
          tokens: 5,
          injectedReferences: [
            {
              offset: 0,
              text: '\n- Use search',
              itemId: 'system-prompt',
              source: { id: 'web', label: 'npm:web', native: false },
              tool: 'search',
            },
          ],
        },
      ],
    },
    120,
    () => [],
  );

  const text = plain(lines);
  assert.match(text, /Prompt Snippet · 5 tokens/);
  assert.ok(text.includes('- Use search\u00A0<-\u00A0npm:web:search'));
});

test('an attribution keeps the preceding word and source label in one wrapping unit', () => {
  const label = 'npm:@eko24ive/pi-ask';
  const content = {
    text: 'Guidelines:',
    injectedReferences: [
      {
        offset: 'Guidelines:'.length,
        text: '\n- Ask the user before choosing between valid directions',
        itemId: 'tool:ask',
        source: { id: 'ask', label, native: false },
        tool: 'ask_user',
      },
    ],
  };
  const joinedSuffix = `directions\u00A0<-\u00A0${label}:ask_user`;

  for (let width = 12; width <= 90; width++) {
    const lines = plain(previewBodyLines(theme, content, width, () => [])).split('\n');
    assert.ok(
      lines.every(line => visibleWidth(line) <= width + 2),
      `bounded lines at width ${width}`,
    );
    if (width >= visibleWidth(joinedSuffix)) {
      assert.ok(
        lines.some(line => line.includes(joinedSuffix)),
        `suffix kept whole at width ${width}`,
      );
    }
  }
});
