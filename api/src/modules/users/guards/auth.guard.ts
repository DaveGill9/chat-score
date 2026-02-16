import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { AuthService } from '../services/auth.service';
  
@Injectable()
export class AuthGuard implements CanActivate {

    constructor(
        private authService: AuthService,
        private reflector: Reflector) {}

    async canActivate(context: ExecutionContext): Promise<boolean> {

        const request = context.switchToHttp().getRequest();
        const accessToken = this.getBearerToken(request);

        const isPublic = this.reflector.getAllAndOverride<boolean>(
            IS_PUBLIC_KEY, 
            [
                context.getHandler(),
                context.getClass(),
            ]);
       
        const user = await this.authService.getUserFromToken(accessToken);
        request['user'] = user;

        if (!user && !isPublic)
            throw new UnauthorizedException();

        return true;
    }

    private getBearerToken(request: Request): string {
        const authHeader = request.headers.authorization;
        if (!authHeader) 
            return '';
        
        const [type, accessToken] = authHeader.split(' ');
        if (type === 'Bearer')
            return accessToken;
        return '';
    }
}