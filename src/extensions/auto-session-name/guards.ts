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
    const userMsgs = sessionManager.getBranch().filter(AutoSessionNameGuard.userEntryFilter);
    return userMsgs.length === 0;
  }

  static isFirstCustomExtensionMessage(sessionManager: Pick<SessionManagerForGuards, 'getBranch'>, whitelist: Set<string>): boolean {
    const customMsg = sessionManager.getBranch().filter(entry => entry.type === 'custom_message' && whitelist.has(entry.customType));
    return customMsg.length === 0;
  }

  private static userEntryFilter(entry: SessionEntry) {
    if (entry.type !== 'message') return false;
    if (entry.message.role !== 'user') return false;
    const { content } = entry.message;
    if (typeof content === 'string') return content !== '';
    if (content.length === 0) return false;
    const onlyContent = content.length === 1 ? content[0] : undefined;
    if (onlyContent?.type === 'text' && onlyContent.text === '') return false;
    return true;
  }
}
