import type { Api, Model } from '@earendil-works/pi-ai';
import type { ModelSelectLayout } from '../../schemas/model-select.config.schema';

export type ModelItem = {
  model: Model<Api>;
  description: string;
  searchText: string;
};

export type ModelLists = {
  favouriteItems: ModelItem[];
  favouriteWarnings: string[];
  searchItems: ModelItem[];
};

export type SelectionSection = 'favourites' | 'search';

export type DialogResult = Model<Api> | null;

export type DialogOptions = {
  currentModel: Model<Api> | undefined;
  favouriteItems: ModelItem[];
  favouriteWarnings: string[];
  hasFavouriteSection: boolean;
  searchItems: ModelItem[];
  providerFilter: string[];
  configWarnings: string[];
  initialSearch: string;
  layout: ModelSelectLayout;
  onDone: (result: DialogResult) => void;
};
