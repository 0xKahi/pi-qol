import z from 'zod';
import { ModelConfigSchema } from './shared-config.schema';

const FavouriteModelSchema = ModelConfigSchema.omit({ reasoning: true });

const ModelSelectLayoutSchema = z.enum(['inline', 'overlay']);
export type ModelSelectLayout = z.infer<typeof ModelSelectLayoutSchema>;

export const ModelSelectConfigSchema = z.object({
  enabled: z.boolean().default(false),
  favourite: z.array(FavouriteModelSchema).default([]),
  provider_filter: z.array(z.string().min(1)).default([]),
  layout: ModelSelectLayoutSchema.default('inline'),
});
export type ModelSelectConfig = z.infer<typeof ModelSelectConfigSchema>;

export const PartialModelSelectConfigSchema = ModelSelectConfigSchema.partial();
export type PartialModelSelectConfig = z.infer<typeof PartialModelSelectConfigSchema>;
