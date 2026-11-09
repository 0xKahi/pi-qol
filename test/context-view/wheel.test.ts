import { expect, test } from 'bun:test';
import type { Theme } from '@earendil-works/pi-coding-agent';
import type { TuiMouseEvent } from '@earendil-works/pi-tui';
import { buildSnapshot, type ContextUsageSnapshot } from '../../src/extensions/context-view/model';
import { ContextViewDialog } from '../../src/extensions/context-view/ui/context-view-dialog';
import { UsageBlockLayer } from '../../src/extensions/context-view/ui/usage-block-layer';
import { UsageView } from '../../src/extensions/context-view/ui/usage-view';

const theme = { fg: (_color: string, text: string) => text, bold: (text: string) => text } as Theme;
const entries = Array.from({ length: 6 }, (_, index) => ({ breadcrumb: [`block-${index}`], tokens: 10, text: `body-${index}` }));
const usage: ContextUsageSnapshot = {
  computedAt: new Date(),
  estimatedTokens: 60,
  reported: { tokens: 60, contextWindow: 1000 },
  categories: entries.map((entry, index) => ({ id: `category-${index}`, label: `Category-${index}`, tokens: 10, entries: [entry] })),
};
function wheel(wheelDelta: number): TuiMouseEvent {
  return {
    type: 'wheel',
    button: 'none',
    x: 1,
    y: 1,
    screenX: 1,
    screenY: 1,
    width: 100,
    height: 40,
    shift: false,
    alt: false,
    ctrl: false,
    wheelDelta,
  };
}

test('normalized wheel amount moves Usage selection without scaling and clamps at bounds', () => {
  const view = new UsageView(theme, { usage });
  view.render(100, 40);
  expect(view.handleMouse(wheel(3))).toEqual({ handled: true });
  expect(view.render(100, 40).join('\n')).toContain('→ ■ Category-3');
  view.handleMouse(wheel(-2));
  expect(view.render(100, 40).join('\n')).toContain('→ ■ Category-1');
  view.handleMouse(wheel(100));
  expect(view.render(100, 40).join('\n')).toContain('→ ■ Category-5');
  expect(view.handleMouse({ ...wheel(0), type: 'move' })).toBeUndefined();
  view.handleInput('\x1b[<64;1;1M');
  expect(view.render(100, 40).join('\n')).toContain('→ ■ Category-5');
});

test('normalized wheel amount steps block stream and consumes even boundary events', () => {
  const layer = new UsageBlockLayer(theme, {
    title: 'Blocks',
    entries,
    entryHeader: entry => entry.breadcrumb[0] ?? '',
    entryBody: entry => [entry.text],
    openFullContent: () => undefined,
  });
  layer.render(100, 40);
  expect(layer.handleMouse(wheel(3))).toEqual({ handled: true });
  expect(layer.render(100, 40).join('\n')).toContain('→ block-3');
  layer.handleMouse(wheel(-2));
  expect(layer.render(100, 40).join('\n')).toContain('→ block-1');
  expect(layer.handleMouse(wheel(-100))).toEqual({ handled: true });
  expect(layer.render(100, 40).join('\n')).toContain('→ block-0');
  expect(layer.handleMouse({ ...wheel(0), type: 'click' })).toBeUndefined();
});

test('ContextViewDialog forwards host wheel input to active Usage then its top block layer', () => {
  const dialog = new ContextViewDialog(
    { terminal: { rows: 100 }, requestRender: () => undefined } as never,
    theme,
    { matches: () => false } as never,
    {
      usage: { ...usage, categories: [{ id: 'all', label: 'All', tokens: 60, entries }, ...usage.categories] },
      initial: buildSnapshot([], 'real-turn', new Date()),
    },
    () => undefined,
  );
  dialog.render(100);
  expect(dialog.handleMouse(wheel(2))).toEqual({ handled: true });
  expect(dialog.render(100).join('\n')).toContain('→ ■ Category-1');
  dialog.handleInput('g');
  dialog.handleInput('g');
  dialog.handleInput('\r');
  dialog.render(100);
  expect(dialog.handleMouse(wheel(3))).toEqual({ handled: true });
  expect(dialog.render(100).join('\n')).toContain('→ [block-3]');
});
