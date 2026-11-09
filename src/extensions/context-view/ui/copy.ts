import { copyToClipboard } from '@earendil-works/pi-coding-agent';
import type { ModalNoticeTone } from '../../../libs/modal/types';

export interface CopyNotice {
  readonly text: string;
  readonly tone: ModalNoticeTone;
  readonly ttlMs: number;
}

export interface NoticeTarget {
  showNotice(text: string, tone: ModalNoticeTone, ttlMs: number): void;
}

export type Clipboard = (text: string) => void | Promise<void>;

/** Copy wiring handed to Context View tabs and layers by the dialog. */
export interface CopyServices {
  readonly notices: NoticeTarget;
  readonly clipboard?: Clipboard;
}

/** Copy `text` and report the outcome through `services.notices`. */
export async function copyWithNotice(services: CopyServices, text: string): Promise<void> {
  showCopyNotice(services.notices, await copyText(text, services.clipboard));
}

/** Copy raw captured content, never terminal-rendered lines. */
export async function copyText(text: string, clipboard: Clipboard = copyToClipboard): Promise<CopyNotice> {
  const normalized = text.replace(/\r\n/g, '\n').replace(/^\n+/, '').trimEnd();
  if (normalized === '') return { text: 'Nothing to copy', tone: 'warning', ttlMs: 5000 };
  try {
    await clipboard(normalized);
    return { text: `Copied ${normalized.length.toLocaleString('en-US')} characters`, tone: 'success', ttlMs: 3000 };
  } catch (error) {
    return { text: `Copy failed: ${error instanceof Error ? error.message : String(error)}`, tone: 'error', ttlMs: 5000 };
  }
}

/** Apply a completed copy result to a modal or a view's notice adapter. */
export function showCopyNotice(target: NoticeTarget, notice: CopyNotice): void {
  target.showNotice(notice.text, notice.tone, notice.ttlMs);
}
