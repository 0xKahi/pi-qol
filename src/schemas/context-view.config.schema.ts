import z from 'zod';

export const ContextViewConfigSchema = z.object({
  enabled: z.boolean().default(false),
});
export type ContextViewConfig = z.infer<typeof ContextViewConfigSchema>;

export const DEFAULT_CONTEXT_VIEW_CONFIG = ContextViewConfigSchema.parse({});

export const PartialContextViewConfigSchema = z.object({
  enabled: z.boolean().optional(),
});
export type PartialContextViewConfig = z.infer<typeof PartialContextViewConfigSchema>;
