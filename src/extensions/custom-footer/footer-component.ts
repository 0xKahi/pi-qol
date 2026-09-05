import { basename } from 'node:path';
import { dye } from '@0xkahi/cli-dye';
import type { Component } from '@earendil-works/pi-tui';
import { truncateToWidth, visibleWidth } from '@earendil-works/pi-tui';
import { pickSubscriptionUsageWindow, resolveSupportedProvider, SubscriptionUsageManager } from './subscription-usage-manager';
import { buildStatsLeft, buildSubscriptionUsageSegment, calculateUsageTotals } from './token-stats';
import type { CustomFooterComponentDeps, CustomFooterConfig } from './types';

const MIN_STATS_MODEL_PADDING = 2;

function sanitizeStatusText(text: string): string {
  return text
    .replace(/[\r\n\t]/g, ' ')
    .replace(/ +/g, ' ')
    .trim();
}

export class CustomFooterComponent implements Component {
  private readonly usageManager: SubscriptionUsageManager;
  private readonly unsubscribeBranch: () => void;
  private readonly unsubscribeAgentDisplay: () => void;
  private restoredDefaultFooter = false;
  private disposed = false;

  constructor(private readonly deps: CustomFooterComponentDeps) {
    this.usageManager = new SubscriptionUsageManager(undefined, () => {
      if (!this.disposed) deps.tui.requestRender();
    });
    this.unsubscribeBranch = deps.footerData.onBranchChange(() => deps.tui.requestRender());
    this.unsubscribeAgentDisplay = deps.agentDisplayState.onChange(() => {
      if (!this.disposed) deps.tui.requestRender();
    });
  }

  invalidate(): void {
    // All footer data is read live on each render.
  }

  dispose(): void {
    this.disposed = true;
    this.unsubscribeBranch();
    this.unsubscribeAgentDisplay();
  }

  render(width: number): string[] {
    if (width <= 0) return [];

    if (!this.deps.config.isEnabled('custom_footer')) {
      if (!this.restoredDefaultFooter) {
        this.restoredDefaultFooter = true;
        this.deps.ctx.ui.setFooter(undefined);
        this.deps.tui.requestRender();
      }
      return [];
    }

    this.restoredDefaultFooter = false;

    const config = this.deps.config.getCustomFooter();
    const lines = [this.renderPathLine(width, config), this.renderStatsLine(width, config)];

    const extensionStatuses = this.deps.footerData.getExtensionStatuses();
    if (extensionStatuses.size > 0) {
      const statusLine = Array.from(extensionStatuses.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([, text]) => sanitizeStatusText(text))
        .join(' ');
      lines.push(truncateToWidth(statusLine, width, this.deps.theme.fg('dim', '...')));
    }

    return lines;
  }

  private renderPathLine(width: number, config: CustomFooterConfig): string {
    const cwd = this.deps.ctx.sessionManager.getCwd();
    const directoryText = `${config.icons.directory}${basename(cwd) || cwd}`;
    const branch = this.deps.footerData.getGitBranch();
    const sessionName = this.deps.ctx.sessionManager.getSessionName();

    let line: string;
    if (config.colors.directory) {
      line = dye.colorize(directoryText, { fg: dye.hex(config.colors.directory) });
      if (branch) line += this.deps.theme.fg('dim', ` (${branch})`);
      if (sessionName) line += this.deps.theme.fg('dim', ` • ${sessionName}`);
    } else {
      let rawLine = directoryText;
      if (branch) rawLine += ` (${branch})`;
      if (sessionName) rawLine += ` • ${sessionName}`;
      line = this.deps.theme.fg('dim', rawLine);
    }

    if (config.display.agentName) {
      line = `${this.renderAgentBadge(config)} ${line}`;
    }

    return truncateToWidth(line, width, this.deps.theme.fg('dim', '...'));
  }

  private renderAgentBadge(config: CustomFooterConfig): string {
    const agentDisplay = this.deps.agentDisplayState.snapshot();
    const badgeText = ` ${agentDisplay.name} `;
    const color = agentDisplay.eventColor ?? config.colors.agentName;
    if (color) {
      return dye
        .colorize({ fg: dye.hex(color) })
        .bold()
        .inverse(badgeText);
    }
    return dye.inverse(dye.bold(this.deps.theme.fg('accent', badgeText)));
  }

  private renderStatsLine(width: number, config: CustomFooterConfig): string {
    const model = this.deps.ctx.model;
    const usingSubscription = model ? this.deps.ctx.modelRegistry.isUsingOAuth(model) : false;
    const contextUsage = this.deps.ctx.getContextUsage();
    const contextWindow = contextUsage?.contextWindow ?? model?.contextWindow ?? 0;
    const subscriptionUsageSegment = this.renderSubscriptionUsageSegment(config, usingSubscription);

    let statsLeft = buildStatsLeft({
      totals: calculateUsageTotals(this.deps.ctx.sessionManager.getEntries()),
      display: config.display,
      icons: config.icons,
      contextUsage,
      contextWindow,
      usingSubscription,
      subscriptionUsageSegment,
      theme: this.deps.theme,
    });

    let statsLeftWidth = visibleWidth(statsLeft);
    if (statsLeftWidth > width) {
      statsLeft = truncateToWidth(statsLeft, width, this.deps.theme.fg('dim', '...'));
      statsLeftWidth = visibleWidth(statsLeft);
    }

    const rightWithoutProvider = this.buildModelNameSegment(config);
    let rightSide = rightWithoutProvider;

    if (this.deps.footerData.getAvailableProviderCount() > 1 && model) {
      const candidate = `${this.deps.theme.fg('dim', `(${model.provider}) `)}${rightWithoutProvider}`;
      if (statsLeftWidth + MIN_STATS_MODEL_PADDING + visibleWidth(candidate) <= width) {
        rightSide = candidate;
      }
    }

    const rightSideWidth = visibleWidth(rightSide);
    const totalNeeded = statsLeftWidth + MIN_STATS_MODEL_PADDING + rightSideWidth;

    if (totalNeeded <= width) {
      return `${statsLeft}${' '.repeat(width - statsLeftWidth - rightSideWidth)}${rightSide}`;
    }

    const availableForRight = width - statsLeftWidth - MIN_STATS_MODEL_PADDING;
    if (availableForRight <= 0) return statsLeft;

    const truncatedRight = truncateToWidth(rightSide, availableForRight, '');
    const truncatedRightWidth = visibleWidth(truncatedRight);
    return `${statsLeft}${' '.repeat(Math.max(0, width - statsLeftWidth - truncatedRightWidth))}${truncatedRight}`;
  }

  private buildModelNameSegment(config: CustomFooterConfig): string {
    const model = this.deps.ctx.model;
    const modelName = model?.id ?? 'no-model';
    const modelNameSegment = config.colors.modelName
      ? dye.colorize(modelName, { fg: dye.hex(config.colors.modelName) })
      : this.deps.theme.fg('dim', modelName);

    if (!model?.reasoning) return modelNameSegment;

    const thinkingLevel = this.deps.getThinkingLevel() || 'off';
    const thinkingLabel = thinkingLevel === 'off' ? 'thinking off' : thinkingLevel;
    return `${modelNameSegment}${this.deps.theme.fg('dim', ` • ${thinkingLabel}`)}`;
  }

  private renderSubscriptionUsageSegment(config: CustomFooterConfig, usingSubscription: boolean): string | undefined {
    const model = this.deps.ctx.model;
    if (!model || !usingSubscription) return undefined;

    const provider = resolveSupportedProvider(model.provider);
    if (!provider) return undefined;

    const response = this.usageManager.ensureFresh(provider);
    if (!response) return undefined;

    const window = pickSubscriptionUsageWindow(response.rateWindow);
    if (!window) return undefined;

    return buildSubscriptionUsageSegment({
      colors: config.colors,
      icons: config.icons,
      theme: this.deps.theme,
      usage: {
        provider,
        responseLabel: response.label,
        windowLabel: window.label,
        usedPercent: window.usedPercent,
        resetDescription: window.resetAt ? this.usageManager.formatResetDescription(window.resetAt) : undefined,
      },
    });
  }
}
