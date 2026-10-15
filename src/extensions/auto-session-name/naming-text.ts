import type { BeforeAgentStartEvent } from '@earendil-works/pi-coding-agent';
import { parseAgentContentToPrompt } from '../../utils/parse-agent-content.util';

type NamingEvent =
  | Pick<Extract<BeforeAgentStartEvent, { messageType: 'user' }>, 'messageType' | 'prompt'>
  | Pick<Extract<BeforeAgentStartEvent, { messageType: 'custom' }>, 'messageType' | 'message'>;

/** True when content has non-whitespace text (images ignored). Shared by current-run and branch-history checks. */
export function hasNamingText(content: Parameters<typeof parseAgentContentToPrompt>[0]): boolean {
  return parseAgentContentToPrompt(content).trim() !== '';
}

export function resolveNamingText(event: NamingEvent, whitelist: ReadonlySet<string>): string | undefined {
  if (event.messageType === 'user') return event.prompt.trim() || undefined;
  if (!whitelist.has(event.message.customType)) return undefined;
  return parseAgentContentToPrompt(event.message.content).trim() || undefined;
}
