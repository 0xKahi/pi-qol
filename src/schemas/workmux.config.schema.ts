import z from 'zod';

export const WorkmuxConfigSchema = z.object({
  enabled: z.boolean().default(false),
});
