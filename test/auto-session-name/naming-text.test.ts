import { describe, expect, test } from 'bun:test';
import type { BeforeAgentStartCustomEvent } from '@earendil-works/pi-coding-agent';
import { resolveNamingText } from '../../src/extensions/auto-session-name/naming-text';

const whitelist: ReadonlySet<string> = new Set(['naming']);

function customEvent(content: BeforeAgentStartCustomEvent['message']['content'], customType = 'naming') {
  return {
    messageType: 'custom' as const,
    message: { role: 'custom' as const, customType, content, display: false, timestamp: Date.now() },
  };
}

describe('resolveNamingText', () => {
  test('trims user prompts without requiring a whitelist', () => {
    expect(resolveNamingText({ messageType: 'user', prompt: '  Fix the bug  ' }, new Set())).toBe('Fix the bug');
  });

  test('accepts whitelisted custom string content', () => {
    expect(resolveNamingText(customEvent('  Review changes  '), whitelist)).toBe('Review changes');
  });

  test('extracts custom text array content and ignores images', () => {
    expect(
      resolveNamingText(
        customEvent([
          { type: 'text', text: '  Review ' },
          { type: 'image', data: 'base64', mimeType: 'image/png' },
          { type: 'text', text: 'changes  ' },
        ]),
        whitelist,
      ),
    ).toBe('Review changes');
  });

  test('rejects non-whitelisted custom messages', () => {
    expect(resolveNamingText(customEvent('Review changes', 'other'), whitelist)).toBeUndefined();
    expect(resolveNamingText(customEvent('Review changes'), new Set())).toBeUndefined();
  });

  test('rejects whitespace-only and image-only content', () => {
    expect(resolveNamingText({ messageType: 'user', prompt: ' \n\t ' }, whitelist)).toBeUndefined();
    expect(resolveNamingText(customEvent(' \n\t '), whitelist)).toBeUndefined();
    expect(resolveNamingText(customEvent([{ type: 'text', text: '   ' }]), whitelist)).toBeUndefined();
    expect(resolveNamingText(customEvent([{ type: 'image', data: 'base64', mimeType: 'image/png' }]), whitelist)).toBeUndefined();
  });
});
