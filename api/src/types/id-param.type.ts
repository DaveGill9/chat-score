import z from "zod";

export const IdParamSchema = z.object({
  id: z.string().trim().min(1).max(36),
});

export type IdParam = z.infer<typeof IdParamSchema>;