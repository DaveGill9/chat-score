import { Controller, Get } from '@nestjs/common';
import { UsersService } from '../services/users.service';
import { type User } from '../entities/user.entity';
import { CurrentUser } from '../decorators/current-user.decorator';
import { Public } from '../decorators/public.decorator';

@Controller('auth')
export class AuthController {

  constructor(
    private readonly usersService: UsersService,
  ) {}

  @Public()
  @Get('init')
  async init(@CurrentUser() currentUser: User | undefined): Promise<User | null> {
    if (!currentUser) {
      return null;
    }
    let user = await this.usersService.findOne<User>(currentUser._id);
    if (!user) {
      user = await this.usersService.createOne(currentUser);
    }
    return {
      _id: user._id,
      displayName: user.displayName,
      email: user.email,
      roles: user.roles,
    };
  }
}
