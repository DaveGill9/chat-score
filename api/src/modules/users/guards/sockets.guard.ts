import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Socket } from 'socket.io';
import { AuthService } from '../services/auth.service';
import { Roles } from '../decorators/roles-decorator';
import { Reflector } from '@nestjs/core';
import { Role } from '../enums/roles.enum';

@Injectable()
export class SocketsGuard implements CanActivate {

    constructor(
        private authService: AuthService,
        private reflector: Reflector
    ) {}

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const client: Socket = context.switchToWs().getClient<Socket>();
        const accessToken = client.handshake.auth?.accessToken || '';

        const roles = this.reflector.getAllAndMerge(
            Roles,
            [
              context.getHandler(),
              context.getClass()
            ]
          );

        const matchRoles = (roles: Role[], userRoles: Role[]) => {
            if (!roles || roles.length === 0)
                return true;

            for (let role of roles) {
                if (userRoles.includes(role))
                    return true;
            }
            return false;
        }

        const user = await this.authService.getUserFromToken(accessToken);
        if (user) {
            client.data['user'] = user;

            if (!matchRoles(roles, user.roles))
                return false;
            
            return true;
        }

        return false;
    }
}