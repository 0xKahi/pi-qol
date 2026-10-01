import { clampPercent } from './progress-bar';
import type { RateWindow } from './subscription-usage-api.util';

export function computePace(window: RateWindow, now = Date.now()): { elapsedPercent: number; pace: 'limit' | 'ahead' | 'on-pace' } | undefined {
  if (
    !window.resetAt ||
    !window.windowSeconds ||
    window.windowSeconds <= 0 ||
    !Number.isFinite(window.windowSeconds) ||
    !Number.isFinite(window.resetAt.getTime())
  )
    return undefined;
  const elapsedPercent = clampPercent(100 * (1 - (window.resetAt.getTime() - now) / (window.windowSeconds * 1000)));
  return { elapsedPercent, pace: window.usedPercent >= 100 ? 'limit' : window.usedPercent > elapsedPercent ? 'ahead' : 'on-pace' };
}

export function formatResetDescription(date: Date, now = Date.now()): string {
  const diffMs = date.getTime() - now;
  if (diffMs <= 0) return 'now';
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  if (hours < 24) return remainingMinutes > 0 ? `${hours}h${remainingMinutes}m` : `${hours}h`;
  const days = Math.floor(hours / 24);
  const remainingHours = hours % 24;
  return remainingHours > 0 ? `${days}d${remainingHours}h` : `${days}d`;
}
