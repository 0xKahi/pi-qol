import { expect, test } from 'bun:test';
import type { Theme } from '@earendil-works/pi-coding-agent';
import { stripTerminalSequences, type TuiMouseEvent } from '@earendil-works/pi-tui';
import { SearchablePreview } from '../../src/extensions/context-view/ui/searchable-preview';
import { VimNavigationScheme } from '../../src/libs/modal/navigation/vim-scheme';

const theme = { fg: (_color: string, text: string) => text, bold: (text: string) => text } as Theme;
const wheel = (wheelDelta: number): TuiMouseEvent => ({
  type: 'wheel',
  button: 'none',
  x: 0,
  y: 0,
  screenX: 0,
  screenY: 0,
  width: 80,
  height: 10,
  shift: false,
  alt: false,
  ctrl: false,
  wheelDelta,
});
function fixture(body = Array.from({ length: 30 }, (_, index) => `${index}: ${index % 5 === 0 ? '\x1b[31mneedle needle\x1b[0m' : 'other'}`)) {
  const copied: string[] = [];
  const notices: unknown[][] = [];
  const preview = new SearchablePreview(theme, {
    title: 'Title',
    body: () => body,
    copyText: () => '\nraw\r\ncontent\n',
    copy: {
      clipboard: text => {
        copied.push(text);
      },
      notices: {
        showNotice: (...args) => {
          notices.push(args);
        },
      },
    },
  });
  return { preview, copied, notices };
}
const plain = (preview: SearchablePreview, width = 80, height = 10) => preview.render(width, height).map(stripTerminalSequences);

test('search captures only query editing, counts matches, highlights current, and wraps n/N', () => {
  const { preview } = fixture(['needle needle', 'other', 'needle']);
  expect(preview.capturesInput()).toBe(false);
  preview.render(80, 10);
  preview.handleInput('/');
  expect(preview.capturesInput()).toBe(true);
  preview.handleInput('needle');
  expect(plain(preview).join('\n')).toContain('1/3');
  expect(preview.render(80, 10).join('\n')).toContain('\x1b[45;97;1m');
  preview.handleInput('\r');
  expect(preview.capturesInput()).toBe(false);
  preview.handleInput('N');
  expect(plain(preview).join('\n')).toContain('3/3');
  preview.handleInput('n');
  expect(plain(preview).join('\n')).toContain('1/3');
  preview.handleInput('n');
  expect(plain(preview).join('\n')).toContain('2/3');
});

test('typing starts at or after top line, and no match keeps scrolling unchanged', () => {
  const { preview } = fixture();
  preview.render(80, 10);
  expect(preview.handleMouse(wheel(7))).toEqual({ handled: true });
  expect(plain(preview)[2]).toContain('7:');
  preview.handleInput('/');
  preview.handleInput('needle');
  expect(plain(preview)[2]).toContain('10:');
  expect(plain(preview).join('\n')).toContain('5/12');
  preview.handleInput('absent');
  expect(plain(preview)[2]).toContain('10:');
  expect(plain(preview).join('\n')).toContain('no matches');
  preview.handleInput('\x1b');
  expect(preview.capturesInput()).toBe(false);
  expect(plain(preview).join('\n')).not.toContain('Search:');
});

test('height is constant across searching, confirmation, cancellation and tiny viewports', () => {
  const { preview } = fixture();
  for (const key of ['', '/', 'needle', '\r', '/', '\x1b']) {
    preview.handleInput(key);
    for (const height of [0, 1, 4, 10, 40]) expect(preview.render(80, height)).toHaveLength(height);
  }
});

test('width changes re-search wrapped lines and preserve current index where possible', () => {
  const preview = new SearchablePreview(theme, {
    title: 'Title',
    body: width => (width > 40 ? ['needle needle', 'needle'] : ['needle', 'needle', 'needle']),
    copyText: () => '',
    copy: { notices: { showNotice() {} } },
  });
  preview.render(80, 10);
  preview.handleInput('/');
  preview.handleInput('needle');
  preview.handleInput('\r');
  preview.handleInput('n');
  expect(plain(preview).join('\n')).toContain('2/3');
  expect(plain(preview, 30).join('\n')).toContain('2/3');
  expect(plain(preview, 30)[2]?.trim()).toBe('needle');
});

test('copy uses complete raw content and ignores y while editing', async () => {
  const { preview, copied, notices } = fixture();
  preview.render(80, 10);
  preview.handleInput('/');
  preview.handleInput('y');
  expect(copied).toEqual([]);
  preview.handleInput('\x1b');
  preview.handleInput('y');
  await Promise.resolve();
  await Promise.resolve();
  expect(copied).toEqual(['raw\ncontent']);
  expect(notices[0]?.[1]).toBe('success');
});

test('normalized wheel deltas clamp and non-wheel events propagate; raw search keys survive Vim mapping', () => {
  const { preview } = fixture();
  preview.render(80, 10);
  preview.handleMouse(wheel(5));
  expect(plain(preview)[2]).toContain('5:');
  preview.handleMouse(wheel(-99));
  expect(plain(preview)[2]).toContain('0:');
  expect(preview.handleMouse({ ...wheel(0), type: 'move' })).toBeUndefined();
  const scheme = new VimNavigationScheme();
  for (const key of ['n', 'N', '/', 'y', 'p']) expect(scheme.consume(key)).toEqual({ handled: false });
});
