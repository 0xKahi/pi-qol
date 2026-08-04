import { describe, expect, test } from 'bun:test';
import type { ExtensionUIContext, KeybindingsManager, Theme } from '@earendil-works/pi-coding-agent';
import type { Component, TUI } from '@earendil-works/pi-tui';
import { ModalDialog, presentModal, type ModalFrame } from '../../src/libs/modal';

const theme = { fg: (_color: string, text: string) => text, bold: (text: string) => text } as Theme;
const keybindings = { matches: () => false } as unknown as KeybindingsManager;
const tui = { terminal: { rows: 24 }, requestRender: () => undefined } as unknown as TUI;

function uiHarness() {
  let receivedOptions: unknown;
  let receivedFrame: ModalFrame | undefined;
  let result: string | undefined;
  const ui = {
    custom: async (factory: (tui: TUI, theme: Theme, keybindings: KeybindingsManager, done: (value: string) => void) => Component, options?: unknown) => {
      receivedOptions = options;
      const component = factory(tui, theme, keybindings, value => {
        result = value;
      });
      component.render(80);
      return result;
    },
  } as unknown as ExtensionUIContext;
  return {
    ui,
    get options() {
      return receivedOptions;
    },
    get frame() {
      return receivedFrame;
    },
    set frame(value: ModalFrame | undefined) {
      receivedFrame = value;
    },
    get result() {
      return result;
    },
  };
}

describe('presentModal', () => {
  test('mounts inline with an inline frame and forwards the result', async () => {
    const harness = uiHarness();
    const result = await presentModal(harness.ui, 'inline', (_tui, _theme, _keybindings, done, frame) => {
      harness.frame = frame;
      done('selected');
      return { render: () => [], invalidate: () => undefined };
    });

    expect(harness.frame).toBe('inline');
    expect(harness.options).toBeUndefined();
    expect(result).toBe('selected');
    expect(harness.result).toBe('selected');
  });

  test('mounts overlay with a bordered frame and shared positioning defaults', async () => {
    const harness = uiHarness();
    const result = await presentModal(harness.ui, 'overlay', (_tui, _theme, _keybindings, done, frame) => {
      harness.frame = frame;
      done('closed');
      return { render: () => [], invalidate: () => undefined };
    });

    expect(harness.frame).toBe('bordered');
    expect(harness.options).toEqual({
      overlay: true,
      overlayOptions: { anchor: 'center', width: '85%', margin: 1 },
    });
    expect(result).toBe('closed');
  });

  test('leaves the dialog height policy independent of presentation layout', async () => {
    const harness = uiHarness();
    await presentModal(harness.ui, 'overlay', (dialogTui, dialogTheme, dialogKeys, done, frame) => {
      const dialog = new ModalDialog({ ...dialogTui, terminal: { rows: 24 } } as TUI, dialogTheme, dialogKeys, {
        tabs: [
          {
            label: 'Items',
            render: () => ['one', 'two', 'three', 'four', 'five', 'six', 'seven'],
            handleInput: () => undefined,
            handleNavigation: () => undefined,
            hints: () => [],
            invalidate: () => undefined,
          },
        ],
        frame,
        height: 'half',
        cancelValue: undefined,
        onComplete: done,
      });
      expect(dialog.render(80).length).toBeLessThanOrEqual(12);
      return dialog;
    });
  });
});
