import { sliceByColumn, stripTerminalSequences, visibleWidth } from '@earendil-works/pi-tui';
import { COLOR_HEX_REGEX } from '../../constants';

const MAX_AGENT_NAME_WIDTH = 10;

function normalizeAgentName(value: string): string {
  const sanitized = stripTerminalSequences(value)
    .replace(/\p{Cc}/gu, '')
    .trim();
  return visibleWidth(sanitized) > MAX_AGENT_NAME_WIDTH ? `${sliceByColumn(sanitized, 0, MAX_AGENT_NAME_WIDTH, true)}...` : sanitized;
}

export type AgentDisplay = {
  name: string;
  eventColor?: string;
};

export class AgentDisplayState {
  private current: AgentDisplay;
  private readonly listeners = new Set<() => void>();

  constructor(defaultName: string) {
    this.current = { name: normalizeAgentName(defaultName) };
  }

  snapshot(): Readonly<AgentDisplay> {
    return this.current;
  }

  reset(defaultName: string): void {
    this.current = { name: normalizeAgentName(defaultName) };
    this.notify();
  }

  update(payload: unknown): boolean {
    if (!payload || typeof payload !== 'object') return false;

    const { agentName, color } = payload as Record<string, unknown>;
    if (typeof agentName !== 'string') return false;

    const name = normalizeAgentName(agentName);
    if (!name) return false;

    this.current = {
      name,
      eventColor: typeof color === 'string' && COLOR_HEX_REGEX.test(color) ? color : undefined,
    };
    this.notify();
    return true;
  }

  onChange(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    for (const listener of this.listeners) listener();
  }
}
