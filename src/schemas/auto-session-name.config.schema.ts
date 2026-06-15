import z from 'zod';
import { ModelConfigschema } from './shared-config.schema';

const AutoSessionNameEnabledSchema = z.object({
  enabled: z.literal(true),
  model: ModelConfigschema,
});

const AutoSessionNameDisabledSchema = z.object({
  enabled: z.literal(false),
  model: ModelConfigschema.optional(),
});

export const AutoSessionNameConfigSchema = z.union([AutoSessionNameEnabledSchema, AutoSessionNameDisabledSchema]);
