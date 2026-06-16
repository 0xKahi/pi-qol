import z from 'zod';

export const ReasoningLevelSchema = z.enum(['off', 'minimal', 'low', 'medium', 'high', 'xhigh']);
export type ReasoningLevel = z.infer<typeof ReasoningLevelSchema>;

export const ModelConfigSchema = z.object({
  provider: z.string(),
  modelId: z.string(),
  reasoning: ReasoningLevelSchema,
});
export type ModelConfig = z.infer<typeof ModelConfigSchema>;
