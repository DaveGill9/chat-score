import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { User } from '../entities/user.entity';

export const CurrentUser = createParamDecorator((_: string, ctx: ExecutionContext) => {
  return ctx.switchToHttp().getRequest().user as User;
});