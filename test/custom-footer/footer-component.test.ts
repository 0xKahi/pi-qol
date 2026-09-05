import { afterEach, describe, expect, test } from 'bun:test';
import { dye } from '@0xkahi/cli-dye';
import { visibleWidth } from '@earendil-works/pi-tui';
import { AgentDisplayState } from '../../src/extensions/custom-footer/agent-display-state';
import { CustomFooterComponent } from '../../src/extensions/custom-footer/footer-component';
import type { CustomFooterColors } from '../../src/extensions/custom-footer/types';

const colors: CustomFooterColors = {
  directory: '#112233',
  modelName: '#445566',
  anthropicUsage: '#D97706',
  codexUsage: '#10B981',
};

const config = {
  enabled: true,
  colors,
  icons: {
    directory: 'DIR ',
    refresh: '↻',
    cache: 'C ',
    cacheRead: 'R ',
    cacheWrite: 'W ',
  },
  display: { tokens: true, cache: true, agentName: false },
  defaultAgentName: 'DEFAULT',
};

type ComponentOptions = {
  colors?: CustomFooterColors;
  agentName?: boolean;
  defaultAgentName?: string;
  event?: unknown;
};

function createComponent(options: ComponentOptions = {}): CustomFooterComponent {
  const agentDisplayState = new AgentDisplayState(options.defaultAgentName ?? config.defaultAgentName);
  if (options.event !== undefined) agentDisplayState.update(options.event);
  const resolvedConfig = {
    ...config,
    colors: options.colors ?? config.colors,
    display: { ...config.display, agentName: options.agentName ?? false },
    defaultAgentName: options.defaultAgentName ?? config.defaultAgentName,
  };

  return new CustomFooterComponent({
    tui: { requestRender: () => {} },
    theme: {
      fg: (color: 'accent' | 'dim' | 'error' | 'warning', text: string) =>
        color === 'accent' ? `\x1b[36m${text}\x1b[39m` : text,
    },
    footerData: {
      getGitBranch: () => 'main',
      getExtensionStatuses: () => new Map(),
      getAvailableProviderCount: () => 1,
      onBranchChange: () => () => {},
    },
    ctx: {
      model: { id: 'model-id', provider: 'test', contextWindow: 128_000, reasoning: false },
      modelRegistry: { isUsingOAuth: () => false },
      sessionManager: {
        getCwd: () => '/repo/demo',
        getSessionName: () => 'session-name',
        getEntries: () => [],
      },
      getContextUsage: () => ({ tokens: 0, contextWindow: 128_000, percent: 0 }),
      ui: { setFooter: () => {} },
    },
    config: {
      isEnabled: () => true,
      getCustomFooter: () => resolvedConfig,
    },
    agentDisplayState,
    getThinkingLevel: () => 'off',
  } as never);
}

function withoutOptionalColors(agentName?: string): CustomFooterColors {
  return {
    agentName,
    anthropicUsage: '#D97706',
    codexUsage: '#10B981',
  };
}

describe('CustomFooterComponent styling', () => {
  afterEach(() => dye.setEnabled(undefined));

  test('applies configured truecolor to directory and model while retaining visible text', () => {
    dye.setEnabled(true);

    const [pathLine, statsLine] = createComponent().render(200);

    expect(pathLine).toContain('\x1b[38;2;17;34;51m');
    expect(statsLine).toContain('\x1b[38;2;68;85;102m');
    expect(dye.strip(pathLine!)).toBe('DIR demo (main) • session-name');
    expect(dye.strip(statsLine!)).toContain('model-id');
  });

  test('renders configured text as plain strings when cli-dye is disabled', () => {
    dye.setEnabled(false);

    const [pathLine, statsLine] = createComponent().render(200);

    expect(pathLine).toBe('DIR demo (main) • session-name');
    expect(statsLine).toContain('model-id');
    expect(`${pathLine}${statsLine}`).not.toContain('\x1b');
  });

  test('keeps the existing path line unchanged when the badge is disabled', () => {
    const [pathLine, statsLine] = createComponent({ colors: withoutOptionalColors() }).render(200);

    expect(pathLine).toBe('DIR demo (main) • session-name');
    expect(statsLine).toContain('model-id');
  });

  test('renders the default name as a padded bold inverse badge without brackets', () => {
    dye.setEnabled(true);
    const [pathLine] = createComponent({ agentName: true, colors: withoutOptionalColors('#123456') }).render(200);

    expect(pathLine).toContain('\x1b[38;2;18;52;86m');
    expect(pathLine).toContain('\x1b[1m');
    expect(pathLine).toContain('\x1b[7m');
    expect(dye.strip(pathLine!)).toBe(' DEFAULT  DIR demo (main) • session-name');
    expect(dye.strip(pathLine!)).not.toContain('[DEFAULT]');
  });

  test('prefers the event color over config and falls back to theme accent', () => {
    dye.setEnabled(true);
    const [eventLine] = createComponent({
      agentName: true,
      colors: withoutOptionalColors('#123456'),
      event: { agentName: 'Builder', color: '#ABCDEF' },
    }).render(200);
    const [accentLine] = createComponent({ agentName: true, colors: withoutOptionalColors() }).render(200);

    expect(eventLine).toContain('\x1b[38;2;171;205;239m');
    expect(eventLine).not.toContain('\x1b[38;2;18;52;86m');
    expect(accentLine).toContain('\x1b[36m');
    expect(accentLine).toContain('\x1b[1m');
    expect(accentLine).toContain('\x1b[7m');
  });

  test('renders sanitized and terminal-width-truncated event names', () => {
    dye.setEnabled(false);
    const [longLine] = createComponent({ agentName: true, event: { agentName: '\x1b[31mVERY-LONG-AGENT-NAME\x1b[0m' } }).render(
      200,
    );
    const [wideLine] = createComponent({ agentName: true, event: { agentName: '  界界界界界界\n' } }).render(200);

    expect(dye.strip(longLine!)).toBe(' VERY-LONG-...  DIR demo (main) • session-name');
    expect(dye.strip(wideLine!)).toBe(' 界界界界界...  DIR demo (main) • session-name');
  });

  test('preserves the leftmost badge during whole-line truncation', () => {
    dye.setEnabled(false);
    const [pathLine] = createComponent({ agentName: true }).render(12);

    expect(dye.strip(pathLine!)).toBe(' DEFAULT ...');
    expect(visibleWidth(pathLine!)).toBe(12);
  });
});
