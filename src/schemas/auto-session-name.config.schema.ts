import z from 'zod';
import { ModelConfigschema } from './shared-config.schema';

export const AutoSessionNameConfigSchema = z.object({
  enabled: z.boolean().default(false),
  model: ModelConfigschema.optional(),
});
export type AutoSessionNameConfig = z.infer<typeof AutoSessionNameConfigSchema>;

export const PartialAutoSessionNameConfigSchema = AutoSessionNameConfigSchema.partial();
export type PartialAutoSessionNameConfig = z.infer<typeof PartialAutoSessionNameConfigSchema>;
