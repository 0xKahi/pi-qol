import { dye } from '@0xkahi/cli-dye';
import type { Theme } from '@earendil-works/pi-coding-agent';
import { matchesKey, visibleWidth } from '@earendil-works/pi-tui';
import { type Hint, ListNavigator, type ModalTab, type NavigationAction, padLine, RenderCache, singleLine, spreadLine } from '../../../libs/modal';
import {
  clampPercent,
  computePace,
  formatResetDescription,
  providerUsageColor,
  type RateWindow,
  renderProgressBar,
  type SubscriptionProvider,
  type SubscriptionUsageCache,
  type UsageCacheEntry,
  type UsageResult,
} from '../../../libs/subscription-usage';

function statusMessage(result: UsageResult | undefined): string | undefined {
  switch (result?.status) {
    case 'ok':
      return undefined;
    case 'no-auth':
      return 'not logged in';
    case 'expired':
      return 'auth expired, re-login';
    case 'http-error':
      return `request failed (HTTP ${result.httpStatus})`;
    case 'network':
      return 'network error';
    case 'unavailable':
      return 'no usage data';
    default:
      return 'loading';
  }
}

function freshness(fetchedAt: number, now: number): string {
  const seconds = Math.max(0, Math.floor((now - fetchedAt) / 1000));
  const age = seconds < 60 ? `${seconds}s` : seconds < 3600 ? `${Math.floor(seconds / 60)}m` : `${Math.floor(seconds / 3600)}h`;
  return `updated ${age} ago`;
}

export class UsageProviderTab implements ModalTab {
  private readonly navigator = new ListNavigator(0, 1);
  private readonly renderCache = new RenderCache();
  private renderedAt: number | undefined;
  private renderedResult: UsageResult | undefined;
  private renderedInFlight: boolean | undefined;
  private renderedSuccess: UsageCacheEntry['lastSuccess'];

  public constructor(
    private readonly theme: Theme,
    private readonly cache: SubscriptionUsageCache,
    public readonly provider: SubscriptionProvider,
    private readonly providerName: string,
    private readonly now: () => number = Date.now,
  ) {}

  public get label(): string {
    return `[${this.providerName}]`;
  }

  public render(width: number, height: number | undefined): string[] {
    const entry = this.cache.get(this.provider);
    const windows = this.windows();
    const now = this.now();
    const second = Math.floor(now / 1000);
    const color = providerUsageColor(this.provider);
    if (
      second !== this.renderedAt ||
      entry?.result !== this.renderedResult ||
      entry?.inFlight !== this.renderedInFlight ||
      entry?.lastSuccess !== this.renderedSuccess
    )
      this.invalidate();
    this.renderedAt = second;
    this.renderedResult = entry?.result;
    this.renderedInFlight = entry?.inFlight;
    this.renderedSuccess = entry?.lastSuccess;
    const cached = this.renderCache.read(width, height);
    if (cached !== undefined) return [...cached];
    const status = entry?.inFlight && windows.length > 0 ? 'refreshing…' : statusMessage(entry?.result);
    const updated = entry?.lastSuccess === undefined ? undefined : freshness(entry.lastSuccess.fetchedAt, now);
    const header = spreadLine(
      this.theme.bold(dye.colorize(this.providerName, { fg: dye.hex(color) })),
      this.theme.fg('muted', status ?? updated ?? ''),
      width,
    );
    const lines = [header];
    if (status !== undefined && updated !== undefined) lines.push(this.theme.fg('muted', updated));
    lines.push('');
    // Keep the selected window visible even when there is no room for chrome.
    if (height !== undefined) lines.length = Math.min(lines.length, Math.max(0, height - 1));
    const available = height === undefined ? windows.length * 2 - 1 : height - lines.length;
    this.navigator.setRowCount(windows.length);
    this.navigator.setVisibleCount(Math.max(1, Math.floor((available + 1) / 2)));
    const labelWidth = Math.max(0, ...windows.map(window => visibleWidth(window.label)));
    for (let index = this.navigator.offset; index < this.navigator.visibleEnd; index++) {
      const window = windows[index];
      if (window !== undefined) {
        if (index > this.navigator.offset) lines.push('');
        lines.push(singleLine(this.renderWindow(window, index === this.navigator.selected, labelWidth, now, color), width));
      }
    }
    const fitted = lines.map(line => singleLine(line, width));
    return [...this.renderCache.write(width, height, fitted)];
  }

  public invalidate(): void {
    this.renderCache.clear();
  }

  public handleInput(data: string): void {
    if (matchesKey(data, 'r')) this.cache.refresh(this.provider);
    this.invalidate();
  }

  public handleNavigation(action: NavigationAction): void {
    this.invalidate();
    this.navigator.setRowCount(this.windows().length);
    switch (action) {
      case 'step-back':
        this.navigator.moveBy(-1);
        break;
      case 'step-forward':
        this.navigator.moveBy(1);
        break;
      case 'page-back':
        this.navigator.page(-1);
        break;
      case 'page-forward':
        this.navigator.page(1);
        break;
      case 'first':
        this.navigator.moveTo(0);
        break;
      case 'last':
        this.navigator.moveTo(this.navigator.selectableCount - 1);
        break;
    }
  }

  public hints(): Hint[] {
    return [['r', 'Refresh']];
  }

  private windows(): RateWindow[] {
    const entry = this.cache.get(this.provider);
    return entry?.result?.status === 'ok' ? entry.result.windows : (entry?.lastSuccess?.windows ?? []);
  }

  private renderWindow(window: RateWindow, selected: boolean, labelWidth: number, now: number, color: string): string {
    const foreground = dye.hex(color);
    const colorize = (text: string) => dye.colorize(text, { fg: foreground });
    const bar = renderProgressBar(window.usedPercent);
    const progress = colorize(bar.filled) + this.theme.fg('dim', bar.empty);
    const reset = window.resetAt === undefined ? '' : this.theme.fg('dim', ` resets ${formatResetDescription(window.resetAt, now)}`);
    const pace = computePace(window, now)?.pace;
    const paceText =
      pace === undefined
        ? ''
        : ` ${this.theme.fg(pace === 'ahead' ? 'warning' : pace === 'limit' ? 'error' : 'muted', pace === 'on-pace' ? 'on pace' : pace)}`;
    const marker = selected ? this.theme.fg('accent', '→ ') : '  ';
    return `${marker}${colorize(padLine(window.label, labelWidth))} ${progress} ${colorize(`${Math.round(clampPercent(window.usedPercent))}%`)}${reset}${paceText}`;
  }
}
