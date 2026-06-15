import z from 'zod';
import { AutoSessionNameConfigSchema, PartialAutoSessionNameConfigSchema } from './auto-session-name.config.schema';

export const ConfigSchema = z.object({
  $schema: z.string().optional(),
  auto_session_name: AutoSessionNameConfigSchema.default({
    enabled: false,
  }),
});
export type Config = z.infer<typeof ConfigSchema>;

export const PartialConfigSchema = z.object({
  $schema: z.string().optional(),
  auto_session_name: PartialAutoSessionNameConfigSchema.optional(),
});
export type PartialConfig = z.infer<typeof PartialConfigSchema>;
