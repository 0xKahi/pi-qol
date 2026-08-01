import z from 'zod';
import { AutoSessionNameConfigSchema, PartialAutoSessionNameConfigSchema } from './auto-session-name.config.schema';
import { ContextViewConfigSchema, DEFAULT_CONTEXT_VIEW_CONFIG, PartialContextViewConfigSchema } from './context-view.config.schema';
import { CustomFooterConfigSchema, DEFAULT_CUSTOM_FOOTER_CONFIG, PartialCustomFooterConfigSchema } from './custom-footer-config.schema';
import { ModelSelectConfigSchema, PartialModelSelectConfigSchema } from './model-select.config.schema';

export const ConfigSchema = z.object({
  $schema: z.string().optional(),
  auto_session_name: AutoSessionNameConfigSchema.default({
    enabled: false,
  }),
  model_select: ModelSelectConfigSchema.default({
    enabled: false,
    favourite: [],
    favourite_label: 'Favourites',
    groups: [],
    hide_tabs: { groups: false, search: false },
    provider_filter: [],
    layout: 'inline',
  }),
  custom_footer: CustomFooterConfigSchema.default(DEFAULT_CUSTOM_FOOTER_CONFIG),
  context_view: ContextViewConfigSchema.default(DEFAULT_CONTEXT_VIEW_CONFIG),
});
export type Config = z.infer<typeof ConfigSchema>;

export const PartialConfigSchema = z.object({
  $schema: z.string().optional(),
  auto_session_name: PartialAutoSessionNameConfigSchema.optional(),
  model_select: PartialModelSelectConfigSchema.optional(),
  custom_footer: PartialCustomFooterConfigSchema.optional(),
  context_view: PartialContextViewConfigSchema.optional(),
});
export type PartialConfig = z.infer<typeof PartialConfigSchema>;
