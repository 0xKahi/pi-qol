import { describe, expect, test } from 'bun:test';
import { AgentDisplayState } from '../../src/extensions/custom-footer/agent-display-state';

describe('AgentDisplayState', () => {
  test('accepts, sanitizes, and notifies for valid updates', () => {
    const state = new AgentDisplayState('DEFAULT');
    let changes = 0;
    state.onChange(() => changes++);

    expect(state.update({ agentName: '  \x1b[31mBuild\x1b[0m\nAgent  ', color: '#A1b2C3' })).toBe(true);
    expect(state.snapshot()).toEqual({ name: 'BuildAgent', eventColor: '#A1b2C3' });
    expect(changes).toBe(1);
  });

  test('ignores malformed and empty names without changing state', () => {
    const state = new AgentDisplayState('DEFAULT');

    for (const payload of [undefined, null, 'agent', {}, { agentName: 42 }, { agentName: '\x1b[31m\n\t' }]) {
      expect(state.update(payload)).toBe(false);
    }
    expect(state.snapshot()).toEqual({ name: 'DEFAULT' });
  });

  test('clears stale event color for colorless and invalid-color updates', () => {
    const state = new AgentDisplayState('DEFAULT');
    state.update({ agentName: 'First', color: '#FFFFFF' });
    state.update({ agentName: 'Second' });
    expect(state.snapshot()).toEqual({ name: 'Second', eventColor: undefined });

    state.update({ agentName: 'Third', color: 'red' });
    expect(state.snapshot()).toEqual({ name: 'Third', eventColor: undefined });
  });

  test('truncates by ten visible columns without splitting wide characters', () => {
    const state = new AgentDisplayState('DEFAULT');
    state.update({ agentName: 'VERY-LONG-AGENT-NAME' });
    expect(state.snapshot().name).toBe('VERY-LONG-...');

    state.update({ agentName: '界界界界界界' });
    expect(state.snapshot().name).toBe('界界界界界...');
  });

  test('reset restores the default and clears event color', () => {
    const state = new AgentDisplayState('DEFAULT');
    state.update({ agentName: 'Builder', color: '#123456' });
    state.reset(' Reviewer ');
    expect(state.snapshot()).toEqual({ name: 'Reviewer' });
  });
});
