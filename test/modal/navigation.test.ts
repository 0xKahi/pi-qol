import { describe, expect, test } from 'bun:test';
import type { KeybindingsManager } from '@earendil-works/pi-coding-agent';
import { PiKeybindingsScheme, VimNavigationScheme } from '../../src/libs/modal';

const keybindings = {
  matches: (data: string, action: string) =>
    ({ up: 'tui.select.up', down: 'tui.select.down', enter: 'tui.select.confirm', esc: 'tui.select.cancel' })[data] === action,
} as unknown as KeybindingsManager;

describe('PiKeybindingsScheme', () => {
  test('maps host select keybindings to actions', () => {
    const scheme = new PiKeybindingsScheme(keybindings);
    expect(scheme.consume('up')).toEqual({ handled: true, action: 'step-back' });
    expect(scheme.consume('down')).toEqual({ handled: true, action: 'step-forward' });
    expect(scheme.consume('enter')).toEqual({ handled: true, action: 'confirm' });
    expect(scheme.consume('esc')).toEqual({ handled: true, action: 'dismiss' });
  });

  test('lets unmapped keys fall through', () => {
    const scheme = new PiKeybindingsScheme(keybindings);
    expect(scheme.consume('x')).toEqual({ handled: false });
    expect(scheme.consume('j')).toEqual({ handled: false });
  });
});

describe('VimNavigationScheme', () => {
  test('maps steps, pages, boundaries, confirm, and dismiss', () => {
    const scheme = new VimNavigationScheme();
    expect(scheme.consume('j').action).toBe('step-forward');
    expect(scheme.consume('k').action).toBe('step-back');
    expect(scheme.consume('\x04').action).toBe('page-forward');
    expect(scheme.consume('\x15').action).toBe('page-back');
    expect(scheme.consume('g')).toEqual({ handled: true });
    expect(scheme.consume('g').action).toBe('first');
    expect(scheme.consume('G').action).toBe('last');
    expect(scheme.consume('\r').action).toBe('confirm');
    expect(scheme.consume('q').action).toBe('dismiss');
    expect(scheme.consume('\x1b').action).toBe('dismiss');
  });

  test('clears interrupted g sequences and swallows replaced navigation keys', () => {
    const scheme = new VimNavigationScheme();
    scheme.consume('g');
    expect(scheme.consume('j').action).toBe('step-forward');
    expect(scheme.consume('g')).toEqual({ handled: true });
    expect(scheme.consume('x')).toEqual({ handled: false });
    expect(scheme.consume('g')).toEqual({ handled: true });

    for (const data of ['\x1b[5~', '\x1b[6~', '\x1b[H', '\x1b[F']) {
      scheme.reset();
      expect(scheme.consume(data)).toEqual({ handled: true });
    }
  });

  test('reset clears a pending gg chord', () => {
    const scheme = new VimNavigationScheme();
    scheme.consume('g');
    scheme.reset();
    expect(scheme.consume('g')).toEqual({ handled: true });
  });
});
