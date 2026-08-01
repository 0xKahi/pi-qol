import { Key, matchesKey } from '@earendil-works/pi-tui';

export type NavigationAction = 'step-back' | 'step-forward' | 'page-back' | 'page-forward' | 'first' | 'last';
export type NavigationResult = { handled: boolean; action?: NavigationAction };

/** Stateful Vim navigation parser shared by both tabs and their previews. */
export class VimNavigation {
  private pendingG = false;

  reset(): void {
    this.pendingG = false;
  }

  consume(data: string): NavigationResult {
    if (data === 'g') {
      if (this.pendingG) {
        this.pendingG = false;
        return { handled: true, action: 'first' };
      }
      this.pendingG = true;
      return { handled: true };
    }

    this.pendingG = false;
    if (data === 'G') return { handled: true, action: 'last' };
    if (matchesKey(data, Key.ctrl('u'))) return { handled: true, action: 'page-back' };
    if (matchesKey(data, Key.ctrl('d'))) return { handled: true, action: 'page-forward' };
    if (matchesKey(data, Key.up) || data === 'k') return { handled: true, action: 'step-back' };
    if (matchesKey(data, Key.down) || data === 'j') return { handled: true, action: 'step-forward' };

    // These keys were intentionally replaced by Vim bindings.
    if (matchesKey(data, Key.pageUp) || matchesKey(data, Key.pageDown) || matchesKey(data, Key.home) || matchesKey(data, Key.end)) {
      return { handled: true };
    }
    return { handled: false };
  }
}
