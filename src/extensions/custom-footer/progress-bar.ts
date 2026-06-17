import { EMPTY_BAR_ICON, FILLED_BAR_ICON, SUBSCRIPTION_BAR_WIDTH } from './constants';

export function clampPercent(usedPercent: number): number {
  return Number.isFinite(usedPercent) ? Math.max(0, Math.min(100, usedPercent)) : 0;
}

export function renderProgressBar(usedPercent: number, width = SUBSCRIPTION_BAR_WIDTH): { filled: string; empty: string } {
  const barWidth = Math.max(0, Math.floor(width));
  const pct = clampPercent(usedPercent);
  const filledCount = Math.round((pct / 100) * barWidth);

  return {
    filled: FILLED_BAR_ICON.repeat(filledCount),
    empty: EMPTY_BAR_ICON.repeat(barWidth - filledCount),
  };
}
