import { Inject, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import axios from 'axios';
import { ConfigService } from '@nestjs/config';
import { User } from '../entities/user.entity';
import { Role } from '../enums/roles.enum';
import jwkToPem from 'jwk-to-pem';
import { UserTokenClaims } from '../types/user-token-claims.type';

@Injectable()
export class AuthService {

  private readonly tokenClockTolerance: number = 5;
  private readonly tokenAudience: string;

  // Important: update the GROUP ID from the Groups in Entra
  private readonly groupRoles: Record<string, Role> = {
    'ADMINISTRATOR-GROUP-GUID': Role.ADMINISTRATOR,
  }

  constructor(
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {
    this.tokenAudience = this.configService.get('MSAL_AUDIENCE', '');
  }

  async getUserFromToken(authToken: string): Promise<User | null> {

    // no token, no user
    if (!authToken) return null;

    // get public key
    const publicKey = await this.getPublicKey(authToken);
    if (!publicKey) return null;

    try {
      const claims = this.jwtService.verify<UserTokenClaims>(
        authToken,
        {
          algorithms: ['RS256'],
          publicKey,
          audience: this.tokenAudience,
          clockTolerance: this.tokenClockTolerance
        });

      // display name
      const _id = claims.sub || '';
      const displayName = claims.name || claims.preferred_username || '';
      const email = (claims.email || claims.emails?.[0] || claims.upn || claims.preferred_username || '').toLowerCase().trim();
      const groups = claims.groups || [];

      // create roles from groups
      const roles: Role[] = [Role.USER];
      groups.forEach(group => {
        const role = this.groupRoles[group];
        if (role && !roles.includes(role))
          roles.push(role);
      });

      return {
        _id,
        email,
        displayName,
        roles,
      };
    }
    catch {
      return null;
    }
  }

  private async fetchMicrosoftPublicKeys(iss: string) {
    try {
      // fetch the openid configuration
      const { data: config } = await axios.get(`${iss}/.well-known/openid-configuration`);
      const jwksUri = config.jwks_uri;

      // fetch the jwks from the jwks_uri
      const { data: jwks } = await axios.get(jwksUri);
      return jwks.keys as { kid: string, x5c: string[] }[];
    }
    catch {
      return [];
    }
  }

  private async getPublicKey(authToken: string): Promise<string | null> {
    const decodedToken = this.jwtService.decode(authToken, { complete: true });
    const kid = decodedToken.header?.kid || '';
    if (!kid) return null;

    const value = await this.cacheManager.get(kid);
    if (value)
      return value as string;

    const iss = decodedToken.payload.iss || '';
    const keys = await this.fetchMicrosoftPublicKeys(iss);
    const key = keys.find(key => key.kid === decodedToken.header.kid);
    if (!key) return null;

    const publicKey = jwkToPem(key);
    await this.cacheManager.set(kid, publicKey, 1000 * 60 * 60 * 24);
    return publicKey;
  }
}
