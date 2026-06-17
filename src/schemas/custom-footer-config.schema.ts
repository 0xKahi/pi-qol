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

const DEFAULT_CUSTOM_FOOTER_COLORS = CustomFooterColorsSchema.parse({});
const DEFAULT_CUSTOM_FOOTER_ICONS = CustomFooterIconsSchema.parse({});
const DEFAULT_CUSTOM_FOOTER_DISPLAY = CustomFooterDisplaySchema.parse({});

export const CustomFooterConfigSchema = z.object({
  enabled: z.boolean().default(false),
  colors: CustomFooterColorsSchema.default(DEFAULT_CUSTOM_FOOTER_COLORS),
  icons: CustomFooterIconsSchema.default(DEFAULT_CUSTOM_FOOTER_ICONS),
  display: CustomFooterDisplaySchema.default(DEFAULT_CUSTOM_FOOTER_DISPLAY),
});
export type CustomFooterConfig = z.infer<typeof CustomFooterConfigSchema>;

export const DEFAULT_CUSTOM_FOOTER_CONFIG = CustomFooterConfigSchema.parse({ enabled: false });

export const PartialCustomFooterConfigSchema = z.object({
  enabled: z.boolean().optional(),
  colors: z
    .object({
      directory: ColorHexSchema.optional(),
      modelName: ColorHexSchema.optional(),
      anthropicUsage: ColorHexSchema.optional(),
      codexUsage: ColorHexSchema.optional(),
    })
    .optional(),
  icons: z
    .object({
      directory: z.string().optional(),
      refresh: z.string().optional(),
      cache: z.string().optional(),
      cacheRead: z.string().optional(),
      cacheWrite: z.string().optional(),
    })
    .optional(),
  display: z
    .object({
      tokens: z.boolean().optional(),
      cache: z.boolean().optional(),
    })
    .optional(),
});
export type PartialCustomFooterConfig = z.infer<typeof PartialCustomFooterConfigSchema>;
