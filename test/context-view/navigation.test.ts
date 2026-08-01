import { describe, expect, test } from 'bun:test';
import { VimNavigation } from '../../src/extensions/context-view/ui/navigation';

describe('Context View Vim navigation', () => {
  test('maps steps, Vim pages, and boundaries', () => {
    const navigation = new VimNavigation();
    expect(navigation.consume('j').action).toBe('step-forward');
    expect(navigation.consume('k').action).toBe('step-back');
    expect(navigation.consume('\x04').action).toBe('page-forward');
    expect(navigation.consume('\x15').action).toBe('page-back');
    expect(navigation.consume('g')).toEqual({ handled: true });
    expect(navigation.consume('g').action).toBe('first');
    expect(navigation.consume('G').action).toBe('last');
  });

  test('clears interrupted g sequences and ignores replaced navigation keys', () => {
    const navigation = new VimNavigation();
    navigation.consume('g');
    expect(navigation.consume('j').action).toBe('step-forward');
    expect(navigation.consume('g')).toEqual({ handled: true });
    expect(navigation.consume('x')).toEqual({ handled: false });
    expect(navigation.consume('g')).toEqual({ handled: true });

    for (const data of ['\x1b[5~', '\x1b[6~', '\x1b[H', '\x1b[F']) {
      navigation.reset();
      expect(navigation.consume(data)).toEqual({ handled: true });
    }
  });
});
