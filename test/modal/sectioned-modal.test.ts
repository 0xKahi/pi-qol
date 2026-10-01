import { describe, expect, test } from 'bun:test';
import type { KeybindingsManager, Theme } from '@earendil-works/pi-coding-agent';
import { visibleWidth } from '@earendil-works/pi-tui';
import { ListTab, ModalDialog, type ModalDialogOptions, type ModalTab, type ModalTabContext, PreviewLayer, SectionedModal, VimNavigationScheme } from '../../src/libs/modal';

const theme = { fg: (_color: string, text: string) => text, bold: (text: string) => text } as Theme;
const keybindings = { matches: (data: string, action: string) => data === '\t' && action === 'tui.input.tab' } as unknown as KeybindingsManager;
const tui = { terminal: { rows: 24 }, requestRender: () => undefined };
function tab(label: string, rows = 1): ModalTab {
  return { label, render: () => Array.from({ length: rows }, () => label), hints: () => [['r', label]], handleInput: () => undefined, handleNavigation: () => undefined };
}
function dialog(tabs: ModalTab[], options: Partial<ModalDialogOptions<string | null>> = {}): ModalDialog<string | null> {
  return new ModalDialog(tui as never, theme, keybindings, { tabs, frame: 'none', navigation: new VimNavigationScheme(), cancelValue: null, onComplete: () => undefined, ...options });
}
function shell(first: ModalDialog<string | null>, second: ModalDialog<string | null>) {
  return new SectionedModal(tui as never, theme, { sections: [{ label: 'First', dialog: first }, { label: 'Second', dialog: second }] });
}

describe('SectionedModal', () => {
  test('initial activation, wrapping, once-only callbacks, focus and active-only input', () => {
    const activations: string[] = [];
    const inputs: string[] = [];
    const one = tab('One');
    const two = tab('Two');
    one.handleInput = data => inputs.push(`one:${data}`);
    two.handleInput = data => inputs.push(`two:${data}`);
    const first = dialog([one]);
    const second = dialog([two]);
    const modal = new SectionedModal(tui as never, theme, { sections: [
      { label: 'First', dialog: first, onActivate: () => activations.push('first') },
      { label: 'Second', dialog: second, onActivate: () => activations.push('second') },
    ] });
    expect(modal.activeSectionIndex).toBe(0);
    expect(modal.render(120).join('\n')).toContain('r One');
    modal.focused = true;
    expect(first.focused).toBe(true);
    modal.handleInput('\x1b[91;5u');
    expect(modal.activeSectionIndex).toBe(1);
    expect(first.focused).toBe(false);
    expect(second.focused).toBe(true);
    modal.handleInput('x');
    expect(inputs).toEqual(['two:x']);
    expect(modal.render(120).join('\n')).toContain('r Two');
    modal.handleInput('\x1d');
    expect(modal.activeSectionIndex).toBe(0);
    modal.handleInput('\x1d');
    modal.handleInput('\x1d');
    expect(activations).toEqual(['first', 'second']);
  });

  test('completion and bare Esc cancel from either section; layers dismiss first and persist', () => {
    const results: Array<string | null> = [];
    let context: ModalTabContext | undefined;
    const content = tab('One');
    content.attach = ctx => { context = ctx; };
    const first = dialog([content], { onComplete: result => results.push(result) });
    const second = dialog([tab('Two')], { onComplete: result => results.push(result) });
    const modal = shell(first, second);
    content.handleNavigation = action => {
      if (action === 'confirm') first.complete('chosen');
    };
    modal.handleInput('\r');
    expect(results).toEqual(['chosen']);
    context?.pushLayer(new PreviewLayer(theme, { title: 'Preview', body: () => ['body'] }));
    modal.handleInput('\x1d');
    modal.handleInput('\x1d');
    expect(modal.render(100).join('\n')).toContain('Preview');
    modal.handleInput('\x1b');
    expect(modal.activeSectionIndex).toBe(0);
    expect(results).toEqual(['chosen']);
    expect(modal.render(100).join('\n')).not.toContain('Preview');
    modal.handleInput('\x1b');
    modal.handleInput('\x1d');
    modal.handleInput('\x1b');
    expect(results).toEqual(['chosen', null, null]);
    expect(modal.activeSectionIndex).toBe(1);
  });

  test('Tab stays inside section and filter, selection and active tab survive round trips', () => {
    const list = new ListTab(theme, { label: 'List', items: ['alpha', 'zeta'], filterText: item => item, renderRow: item => item, onConfirm: () => undefined });
    const first = dialog([list, tab('Other')], { navigation: undefined, filter: {} });
    const modal = shell(first, dialog([tab('Two')]));
    modal.handleInput('z');
    modal.handleInput('\t');
    expect(first.activeIndex).toBe(1);
    expect(modal.activeSectionIndex).toBe(0);
    modal.handleInput('\x1d');
    modal.handleInput('\x1d');
    expect(first.activeIndex).toBe(1);
    modal.handleInput('\x1b[Z');
    expect(first.activeIndex).toBe(0);
    expect(modal.render(100).join('\n')).toContain('zeta');
    expect(modal.render(100).join('\n')).not.toContain('alpha');
  });

  test('switch resets a pending Vim gg chord', () => {
    const actions: string[] = [];
    const content = tab('One');
    content.handleNavigation = action => actions.push(action);
    const modal = shell(dialog([content]), dialog([tab('Two')]));
    modal.handleInput('g');
    modal.handleInput('\x1d');
    modal.handleInput('\x1d');
    modal.handleInput('g');
    expect(actions).toEqual([]);
    modal.handleInput('g');
    expect(actions).toEqual(['first']);
  });

  test('single-section keys are consumed without hints; configured initial section works', () => {
    const inputs: string[] = [];
    const content = tab('One');
    content.handleInput = data => inputs.push(data);
    const modal = new SectionedModal(tui as never, theme, { sections: [{ label: 'Only', dialog: dialog([content]) }] });
    modal.handleInput('\x1d');
    modal.handleInput('\x1b[91;5u');
    expect(inputs).toEqual([]);
    expect(modal.render(100).join('\n')).not.toContain('Section');
    const initial = new SectionedModal(tui as never, theme, { sections: [{ label: 'One', dialog: dialog([content]) }, { label: 'Two', dialog: dialog([tab('Two')]) }], initialSectionIndex: 1 });
    expect(initial.activeSectionIndex).toBe(1);
  });

  test('frame strip adds no height, hints follow sections, natural heights change, widths fit', () => {
    for (const frame of ['inline', 'bordered'] as const) {
      const first = dialog([tab('One')]);
      const second = dialog([tab('Two', 4)]);
      const modal = new SectionedModal(tui as never, theme, { frame, sections: [{ label: 'First', dialog: first }, { label: 'Second', dialog: second }] });
      expect(modal.render(100).length).toBe(dialog([tab('One')], { frame }).render(100).length);
      expect(modal.render(100).join('\n')).toContain('^]/^[ Section');
      expect(modal.render(100)[0]).toContain('First');
      const height = modal.render(100).length;
      modal.handleInput('\x1d');
      expect(modal.render(100).length).toBe(height + 3);
      expect(modal.render(100).join('\n')).toContain('^]/^[ Section');
      for (const line of modal.render(20)) expect(visibleWidth(line)).toBeLessThanOrEqual(20);
      if (frame === 'bordered') expect(modal.render(20)[0]).toMatch(/^╭.*╮$/);
    }
    const bounded = shell(dialog([tab('One', 40)], { height: 'half' }), dialog([tab('Two')]));
    expect(bounded.render(80).length).toBe(dialog([tab('One', 40)], { frame: 'inline', height: 'half' }).render(80).length);
  });
});
