import { afterEach, describe, expect, test } from 'bun:test';
import { dye } from '@0xkahi/cli-dye';
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
  display: { tokens: true, cache: true },
};

function createComponent(colors: CustomFooterColors = config.colors): CustomFooterComponent {
  return new CustomFooterComponent({
    tui: { requestRender: () => {} },
    theme: { fg: (_color: 'dim' | 'error' | 'warning', text: string) => text },
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
      getCustomFooter: () => ({ ...config, colors }),
    },
    getThinkingLevel: () => 'off',
  } as never);
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

  test('uses the existing theme fallback when optional colors are absent', () => {
    const component = createComponent({
      anthropicUsage: '#D97706',
      codexUsage: '#10B981',
    });

    const [pathLine, statsLine] = component.render(200);

    expect(pathLine).toBe('DIR demo (main) • session-name');
    expect(statsLine).toContain('model-id');
  });
});
