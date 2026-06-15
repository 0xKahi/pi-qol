import z from 'zod';

export const ReasoningLevelSchema = z.enum(['off', 'minimal', 'low', 'medium', 'high', 'xhigh']);
export const ModelConfigschema = z.object({
  provider: z.string(),
  modelId: z.string(),
  reasoning: ReasoningLevelSchema,
});
