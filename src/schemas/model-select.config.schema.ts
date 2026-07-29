import z from 'zod';
import { ModelConfigSchema, ReasoningLevelSchema } from './shared-config.schema';

const NonEmptyNameSchema = z.string().min(1);

const FavouriteModelSchema = ModelConfigSchema.omit({ reasoning: true }).extend({
  groups: z.array(NonEmptyNameSchema).default([]),
});

const HideTabsSchema = z.object({
  groups: z.boolean().default(false),
  search: z.boolean().default(false),
});

const ModelSelectLayoutSchema = z.enum(['inline', 'overlay']);
export type ModelSelectLayout = z.infer<typeof ModelSelectLayoutSchema>;

export const ModelSelectConfigSchema = z.object({
  enabled: z.boolean().default(false),
  favourite: z.array(FavouriteModelSchema).default([]),
  favourite_label: NonEmptyNameSchema.default('Favourites'),
  groups: z.array(NonEmptyNameSchema).default([]),
  hide_tabs: HideTabsSchema.default({ groups: false, search: false }),
  provider_filter: z.array(NonEmptyNameSchema).default([]),
  default_reasoning: ReasoningLevelSchema.optional(),
  layout: ModelSelectLayoutSchema.default('inline'),
});
export type ModelSelectConfig = z.infer<typeof ModelSelectConfigSchema>;

export const PartialModelSelectConfigSchema = z.object({
  enabled: z.boolean().optional(),
  favourite: z
    .array(
      ModelConfigSchema.omit({ reasoning: true }).extend({
        groups: z.array(NonEmptyNameSchema).optional(),
      }),
    )
    .optional(),
  favourite_label: NonEmptyNameSchema.optional(),
  groups: z.array(NonEmptyNameSchema).optional(),
  hide_tabs: z
    .object({
      groups: z.boolean().optional(),
      search: z.boolean().optional(),
    })
    .optional(),
  provider_filter: z.array(NonEmptyNameSchema).optional(),
  default_reasoning: ReasoningLevelSchema.optional(),
  layout: ModelSelectLayoutSchema.optional(),
});
export type PartialModelSelectConfig = z.infer<typeof PartialModelSelectConfigSchema>;
