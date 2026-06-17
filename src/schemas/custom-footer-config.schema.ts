import z from 'zod';
import { ColorHexSchema } from './shared-config.schema';

const CustomFooterColorsSchema = z.object({
  directory: ColorHexSchema.optional(),
  modelName: ColorHexSchema.optional(),
  anthropicUsage: ColorHexSchema.optional().default('#D97706'),
  codexUsage: ColorHexSchema.optional().default('#10B981'),
});

const CustomFooterIconsSchema = z.object({
  directory: z.string().optional().default(' '),
  refresh: z.string().optional().default(''),
  cache: z.string().optional().default(' '),
  cacheRead: z.string().optional().default(' '),
  cacheWrite: z.string().optional().default(' '),
});

const CustomFooterDisplaySchema = z.object({
  tokens: z.boolean().optional().default(true),
  cache: z.boolean().optional().default(true),
});

export const CustomFooterConfigSchema = z.object({
  enabled: z.boolean().default(false),
  colors: CustomFooterColorsSchema.optional(),
  icons: CustomFooterIconsSchema.optional(),
  display: CustomFooterDisplaySchema.optional(),
});
export type CustomFooterConfig = z.infer<typeof CustomFooterConfigSchema>;
