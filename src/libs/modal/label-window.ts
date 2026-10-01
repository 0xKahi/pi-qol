import { visibleWidth } from '@earendil-works/pi-tui';

/** Shared active-centered window for tab and section strips. */
export function labelWindow(labels: string[], activeIndex: number, width: number, separator: string): { start: number; end: number } {
  const measure = (start: number, end: number): number => {
    const parts = labels.slice(start, end + 1);
    if (start > 0) parts.unshift('…');
    if (end < labels.length - 1) parts.push('…');
    return visibleWidth(parts.join(separator));
  };
  if (visibleWidth(labels.join(separator)) <= width) return { start: 0, end: labels.length - 1 };
  let start = activeIndex;
  let end = activeIndex;
  let expandLeft = true;
  while (true) {
    const nextStart = expandLeft && start > 0 ? start - 1 : start;
    const nextEnd = !expandLeft && end < labels.length - 1 ? end + 1 : end;
    expandLeft = !expandLeft;
    if (nextStart === start && nextEnd === end) break;
    if (measure(nextStart, nextEnd) <= width) {
      start = nextStart;
      end = nextEnd;
      continue;
    }
    const otherStart = start > 0 ? start - 1 : start;
    const otherEnd = end < labels.length - 1 ? end + 1 : end;
    if ((otherStart === start && otherEnd === end) || measure(otherStart, otherEnd) > width) break;
    start = otherStart;
    end = otherEnd;
  }
  return { start, end };
}
