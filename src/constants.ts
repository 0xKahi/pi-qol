import type { ObjectValues } from './types';

export const EXTENSION_ID = 'pi-qol';
export const SET_AGENT_NAME_EVENT_ID = 'pi.qol.event:set-agent-name';

const SUB_EXTENSION_IDS = {
  auto_session_name: 'auto_session_name',
  model_select: 'model_select',
  custom_footer: 'custom_footer',
  context_view: 'context_view',
} as const;

export type SubExtentionIds = ObjectValues<typeof SUB_EXTENSION_IDS>;

export const piVimKeyEventId = (type: SubExtentionIds, extra: string[] = []) => {
  let id = `pi.vimKeys.event:${EXTENSION_ID}.${type}`;
  extra.forEach(val => {
    id = `${id}.${val}`;
  });
  return id;
};

export const COLOR_HEX_REGEX = /^#[0-9a-fA-F]{6}$/;
