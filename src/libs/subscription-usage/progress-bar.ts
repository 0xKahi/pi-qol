export function clampPercent(n: number): number {
  return Number.isFinite(n) ? Math.max(0, Math.min(100, n)) : 0;
}

export function renderProgressBar(
  usedPercent: number,
  width = 10,
  glyphs: { filled: string; empty: string } = { filled: '█', empty: '░' },
): { filled: string; empty: string } {
  const barWidth = Number.isFinite(width) ? Math.max(0, Math.floor(width)) : 0;
  const filledCount = Math.round((clampPercent(usedPercent) / 100) * barWidth);
  return { filled: glyphs.filled.repeat(filledCount), empty: glyphs.empty.repeat(barWidth - filledCount) };
}
