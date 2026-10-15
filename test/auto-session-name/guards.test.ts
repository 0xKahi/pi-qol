import { describe, expect, test } from 'bun:test';
import type { SessionEntry, SessionHeader } from '@earendil-works/pi-coding-agent';
import { AutoSessionNameGuard } from '../../src/extensions/auto-session-name/guards';

function sessionHeader(overrides: Partial<SessionHeader> = {}): SessionHeader {
  return {
    type: 'session',
    id: 'session-id',
    timestamp: '2026-01-01T00:00:00.000Z',
    cwd: '/tmp/project',
    ...overrides,
  };
}

function messageEntry(role: 'user' | 'assistant' | 'toolResult'): SessionEntry {
  return {
    type: 'message',
    id: `${role}-entry`,
    parentId: null,
    timestamp: '2026-01-01T00:00:00.000Z',
    message: {
      role,
      content: role === 'toolResult' ? [] : 'content',
      timestamp: Date.now(),
      ...(role === 'toolResult' ? { toolCallId: 'tool-call-id', toolName: 'tool', isError: false } : {}),
    },
  } as SessionEntry;
}

type EntryContent = Extract<SessionEntry, { type: 'custom_message' }>['content'];

const IMAGE = { type: 'image' as const, data: 'base64', mimeType: 'image/png' };
const EMPTY_CONTENTS: EntryContent[] = [
  '',
  '  \n\t ',
  [],
  [{ type: 'text', text: '' }],
  [{ type: 'text', text: '   ' }],
  [IMAGE],
  [{ type: 'text', text: '' }, IMAGE],
];

function customEntry(customType: string, content: EntryContent = 'Review changes'): SessionEntry {
  return {
    type: 'custom_message',
    id: 'custom-entry',
    parentId: null,
    timestamp: '2026-01-01T00:00:00.000Z',
    customType,
    content,
    display: false,
  };
}

describe('AutoSessionNameGuard', () => {
  const whitelist: ReadonlySet<string> = new Set(['naming']);

  test('isFirstNamingTurn is true with zero prior user messages', () => {
    expect(AutoSessionNameGuard.isFirstNamingTurn({ getBranch: () => [] }, whitelist)).toBe(true);
    expect(AutoSessionNameGuard.isFirstNamingTurn({ getBranch: () => [messageEntry('assistant')] }, whitelist)).toBe(true);
  });

  test('isFirstNamingTurn is false with one or more prior user messages', () => {
    expect(AutoSessionNameGuard.isFirstNamingTurn({ getBranch: () => [messageEntry('user')] }, whitelist)).toBe(false);
    expect(AutoSessionNameGuard.isFirstNamingTurn({ getBranch: () => [messageEntry('user'), messageEntry('user')] }, whitelist)).toBe(false);
  });

  test('whitelisted custom entries with text block naming', () => {
    expect(AutoSessionNameGuard.isFirstNamingTurn({ getBranch: () => [customEntry('naming')] }, whitelist)).toBe(false);
  });

  test('whitelisted custom entries without text (empty, whitespace, image-only) do not block naming', () => {
    for (const content of EMPTY_CONTENTS) {
      expect(AutoSessionNameGuard.isFirstNamingTurn({ getBranch: () => [customEntry('naming', content)] }, whitelist)).toBe(true);
    }
  });

  test('non-whitelisted custom entries do not block naming', () => {
    expect(AutoSessionNameGuard.isFirstNamingTurn({ getBranch: () => [customEntry('other')] }, whitelist)).toBe(true);
    expect(AutoSessionNameGuard.isFirstNamingTurn({ getBranch: () => [customEntry('naming')] }, new Set())).toBe(true);
  });

  test('user messages without text (empty, whitespace, image-only) are ignored', () => {
    for (const content of EMPTY_CONTENTS) {
      const entry = messageEntry('user');
      if (entry.type === 'message' && entry.message.role === 'user') entry.message.content = content;
      expect(AutoSessionNameGuard.isFirstNamingTurn({ getBranch: () => [entry] }, whitelist)).toBe(true);
    }
  });

  test('isSessionNameSet follows pi.getSessionName', () => {
    expect(AutoSessionNameGuard.isSessionNameSet({ getSessionName: () => 'Existing title' })).toBe(true);
    expect(AutoSessionNameGuard.isSessionNameSet({ getSessionName: () => undefined })).toBe(false);
  });

  test('isChildSession is true for fork session start reason', () => {
    expect(AutoSessionNameGuard.isChildSession({ startReason: 'fork', manager: { getHeader: () => sessionHeader() } })).toBe(true);
  });

  test('isChildSession is true when header has parentSession', () => {
    expect(
      AutoSessionNameGuard.isChildSession({
        startReason: 'new',
        manager: { getHeader: () => sessionHeader({ parentSession: '/tmp/parent.jsonl' }) },
      }),
    ).toBe(true);
  });

  test('isChildSession is false for normal parentless sessions', () => {
    expect(AutoSessionNameGuard.isChildSession({ startReason: 'new', manager: { getHeader: () => sessionHeader() } })).toBe(false);
  });
});
