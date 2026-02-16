import { z } from 'zod';

export const UserTokenClaimsSchema = z.object({
  sub: z.string().optional(),
  name: z.string().optional(),
  preferred_username: z.string().optional(),
  email: z.string().optional(),
  emails: z.array(z.string()).optional(),
  upn: z.string().optional(),
  groups: z.array(z.string()).optional(),
});

export type UserTokenClaims = z.infer<typeof UserTokenClaimsSchema>;
