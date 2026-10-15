import z from 'zod';
import { ModelConfigSchema } from './shared-config.schema';

export const AutoSessionNameConfigSchema = z.object({
  enabled: z.boolean().default(false),
  model: ModelConfigSchema.optional(),
  custom_message_whitelist: z
    .array(z.string())
    .default([])
    .describe('customType values of pi custom messages (sent with triggerTurn) that may trigger auto session naming. Empty = only user prompts.'),
});
export type AutoSessionNameConfig = z.infer<typeof AutoSessionNameConfigSchema>;

export const PartialAutoSessionNameConfigSchema = z.object({
  enabled: z.boolean().optional(),
  model: ModelConfigSchema.optional(),
  custom_message_whitelist: z.array(z.string()).optional(),
});
export type PartialAutoSessionNameConfig = z.infer<typeof PartialAutoSessionNameConfigSchema>;
