import { piVimKeyEventId } from '../../constants';

export const COMMAND_NAME = 'select-model';
export const MAX_VISIBLE_MODELS = 10;
export const MAX_CONFIG_WARNING_LINES = 4;

// Cross-extension activation hook (for example, pi-vim-keys can emit this to open the picker).
export const PI_VIM_KEY_EVENT_ID = piVimKeyEventId('model_select');
