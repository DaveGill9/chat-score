import { Reflector } from '@nestjs/core';
import { Role } from '../enums/roles.enum';

export const Roles = Reflector.createDecorator<Role[]>();