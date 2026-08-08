import z from 'zod';
import { ModelConfigSchema } from './shared-config.schema';

export const AutoSessionNameConfigSchema = z.object({
  enabled: z.boolean().default(false),
  model: ModelConfigSchema.optional(),
  // customMessageWhitelist: z.array(z.string()).describe('a list of pi  custom_messages, customType to be used to trigger auto session name'),
});
export type AutoSessionNameConfig = z.infer<typeof AutoSessionNameConfigSchema>;

export const PartialAutoSessionNameConfigSchema = AutoSessionNameConfigSchema.partial();
export type PartialAutoSessionNameConfig = z.infer<typeof PartialAutoSessionNameConfigSchema>;
