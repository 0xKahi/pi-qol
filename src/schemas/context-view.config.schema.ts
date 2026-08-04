import z from 'zod';

const ContextViewLayoutSchema = z.enum(['inline', 'overlay']);
export type ContextViewLayout = z.infer<typeof ContextViewLayoutSchema>;

export const ContextViewConfigSchema = z.object({
  enabled: z.boolean().default(false),
  layout: ContextViewLayoutSchema.default('inline'),
});
export type ContextViewConfig = z.infer<typeof ContextViewConfigSchema>;

export const DEFAULT_CONTEXT_VIEW_CONFIG = ContextViewConfigSchema.parse({});

export const PartialContextViewConfigSchema = z.object({
  enabled: z.boolean().optional(),
  layout: ContextViewLayoutSchema.optional(),
});
export type PartialContextViewConfig = z.infer<typeof PartialContextViewConfigSchema>;
