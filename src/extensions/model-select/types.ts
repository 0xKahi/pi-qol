import type { Api, Model } from '@earendil-works/pi-ai';
import type { ModalFrame } from '../../libs/modal';
import type { ReasoningLevel } from '../../schemas/shared-config.schema';

export type ModelItem = {
  model: Model<Api>;
  description: string;
  searchText: string;
};

export type ModelGroupList = {
  name: string;
  items: ModelItem[];
};

export type ModelLists = {
  favouriteItems: ModelItem[];
  favouriteWarnings: string[];
  groupLists: ModelGroupList[];
  searchItems: ModelItem[];
};

export type TabIdentity = { kind: 'favourites' } | { kind: 'group'; name: string } | { kind: 'search' };

export type DialogResult = Model<Api> | null;

export type DialogOptions = {
  currentModel: Model<Api> | undefined;
  favouriteItems: ModelItem[];
  favouriteLabel: string;
  favouriteWarnings: string[];
  groupLists: ModelGroupList[];
  searchItems: ModelItem[];
  hideGroupTabs: boolean;
  hideSearchTab: boolean;
  providerFilter: string[];
  defaultReasoning?: ReasoningLevel;
  configWarnings: string[];
  initialSearch: string;
  frame: ModalFrame;
  onDone: (result: DialogResult) => void;
};
