import { z } from 'zod';
import { Role } from "../enums/roles.enum";

export const CreateUserSchema = z.object({
  _id: z.string().trim().max(100).min(1),
  email: z.string().email().trim().max(255),
  displayName: z.string().trim().max(100),
  roles: z.array(z.enum(Object.values(Role) as [string, ...string[]])),
});

export type CreateUser = z.infer<typeof CreateUserSchema>;