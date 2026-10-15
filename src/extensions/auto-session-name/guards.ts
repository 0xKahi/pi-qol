import type { ExtensionAPI, SessionEntry, SessionHeader } from '@earendil-works/pi-coding-agent';
import { hasNamingText } from './naming-text';

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

  static isFirstNamingTurn(sessionManager: Pick<SessionManagerForGuards, 'getBranch'>, whitelist: ReadonlySet<string>): boolean {
    // Pi emits before_agent_start before appending the starting message (user or custom).
    // Only prior entries that could themselves have produced a name block naming.
    return !sessionManager.getBranch().some(entry => AutoSessionNameGuard.isNamingEntry(entry, whitelist));
  }

  private static isNamingEntry(entry: SessionEntry, whitelist: ReadonlySet<string>): boolean {
    if (entry.type === 'message') return entry.message.role === 'user' && hasNamingText(entry.message.content);
    if (entry.type === 'custom_message') return whitelist.has(entry.customType) && hasNamingText(entry.content);
    return false;
  }
}
