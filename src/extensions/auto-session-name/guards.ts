import type { ExtensionAPI, SessionEntry, SessionHeader } from '@earendil-works/pi-coding-agent';

type SessionManagerForGuards = {
  getBranch(): SessionEntry[];
  getHeader(): SessionHeader | null;
};

export class AutoSessionNameGuard {
  static isSessionNameSet(pi: Pick<ExtensionAPI, 'getSessionName'>): boolean {
    return pi.getSessionName() !== undefined;
  }

  static isChildSession(sessionOpts: { startReason?: string; manager: Pick<SessionManagerForGuards, 'getHeader'> }): boolean {
    return sessionOpts.startReason === 'fork' || Boolean(sessionOpts.manager.getHeader()?.parentSession);
  }

  static isUsersFirstTurn(sessionManager: Pick<SessionManagerForGuards, 'getBranch'>): boolean {
    // Pi emits before_agent_start before appending the current user message, so a fresh opening turn has zero prior user messages.
    const userMsgs = sessionManager.getBranch().filter(entry => entry.type === 'message' && entry.message.role === 'user');
    return userMsgs.length === 0;
  }
}
