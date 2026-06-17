import z from 'zod';
import { AutoSessionNameConfigSchema, PartialAutoSessionNameConfigSchema } from './auto-session-name.config.schema';
import { CustomFooterConfigSchema } from './custom-footer-config.schema';
import { ModelSelectConfigSchema, PartialModelSelectConfigSchema } from './model-select.config.schema';

export const ConfigSchema = z.object({
  $schema: z.string().optional(),
  auto_session_name: AutoSessionNameConfigSchema.default({
    enabled: false,
  }),
  model_select: ModelSelectConfigSchema.default({
    enabled: false,
    favourite: [],
    provider_filter: [],
    layout: 'inline',
  }),
  custom_footer: CustomFooterConfigSchema.default({
    enabled: false,
  }),
});
export type Config = z.infer<typeof ConfigSchema>;

export const PartialConfigSchema = z.object({
  $schema: z.string().optional(),
  auto_session_name: PartialAutoSessionNameConfigSchema.optional(),
  model_select: PartialModelSelectConfigSchema.optional(),
  custom_footer: CustomFooterConfigSchema.optional(),
});
export type PartialConfig = z.infer<typeof PartialConfigSchema>;
