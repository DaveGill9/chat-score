import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Observable } from 'rxjs';
import { Reflector } from '@nestjs/core';
import { Roles } from '../decorators/roles-decorator';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { Role } from '../enums/roles.enum';

@Injectable()
export class RolesGuard implements CanActivate {

    constructor(private reflector: Reflector) { }

    canActivate(context: ExecutionContext): boolean | Promise<boolean> | Observable<boolean> {

        const isPublic = this.reflector.getAllAndOverride<boolean>(
            IS_PUBLIC_KEY,
            [
                context.getHandler(),
                context.getClass(),
            ]);

        const roles = this.reflector.getAllAndMerge(
            Roles,
            [
                context.getHandler(),
                context.getClass()
            ]
        );

        if (!roles || roles.length === 0 || isPublic)
            return true;

        const request = context.switchToHttp().getRequest();
        const user = request.user;

        const matchRoles = (roles: Role[], userRoles: Role[]) => {
            for (let role of roles) {
                if (userRoles.includes(role))
                    return true;
            }
            return false;
        }

        return matchRoles(roles, user.roles);
    }
}
