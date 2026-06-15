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

describe('AutoSessionNameGuard', () => {
  test('isUsersFirstTurn is true with zero prior user messages', () => {
    expect(AutoSessionNameGuard.isUsersFirstTurn({ getBranch: () => [] })).toBe(true);
    expect(AutoSessionNameGuard.isUsersFirstTurn({ getBranch: () => [messageEntry('assistant')] })).toBe(true);
  });

  test('isUsersFirstTurn is false with one or more prior user messages', () => {
    expect(AutoSessionNameGuard.isUsersFirstTurn({ getBranch: () => [messageEntry('user')] })).toBe(false);
    expect(AutoSessionNameGuard.isUsersFirstTurn({ getBranch: () => [messageEntry('user'), messageEntry('user')] })).toBe(false);
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
      AutoSessionNameGuard.isChildSession({ startReason: 'new', manager: { getHeader: () => sessionHeader({ parentSession: '/tmp/parent.jsonl' }) } }),
    ).toBe(true);
  });

  test('isChildSession is false for normal parentless sessions', () => {
    expect(AutoSessionNameGuard.isChildSession({ startReason: 'new', manager: { getHeader: () => sessionHeader() } })).toBe(false);
  });
});
