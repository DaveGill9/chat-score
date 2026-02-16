import { Controller, Get, Param, Query } from '@nestjs/common';
import { UsersService } from '../services/users.service';
import { type User } from '../entities/user.entity';
import { ZodValidationPipe } from 'src/pipes/zod-validation.pipe';
import { type IdParam, IdParamSchema } from 'src/types/id-param.type';
import { type FindUsersFilter, FindUsersFilterSchema } from '../types/find-users-filter.type';

@Controller('users')
export class UsersController {

  constructor(
    private readonly usersService: UsersService,
  ) {}

  @Get()
  async findMany(@Query(new ZodValidationPipe(FindUsersFilterSchema)) filter: FindUsersFilter): Promise<User[]> {
    return await this.usersService.findMany<User>(filter);
  }

  @Get(':id')
  async findOne(@Param(new ZodValidationPipe(IdParamSchema)) params: IdParam): Promise<User | null> {
    return await this.usersService.findOne<User>(params.id);
  }
}
