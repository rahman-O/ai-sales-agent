import { Injectable, UnauthorizedException } from '@nestjs/common';
import * as jose from 'jose';
import { AppConfigService } from '../config/config.service.js';

export interface VerifiedIdentity {
  sub: string;
  exp: number;
}

/**
 * Default: asymmetric JWKS verification against Supabase.
 * Legacy HS256 via SUPABASE_JWT_SECRET is compatibility/test fallback only — not production default.
 */
@Injectable()
export class JwtVerifierService {
  private jwks: ReturnType<typeof jose.createRemoteJWKSet> | null = null;

  constructor(private readonly config: AppConfigService) {}

  async verifyAccessToken(token: string): Promise<VerifiedIdentity> {
    try {
      if (this.config.env.SUPABASE_JWT_SECRET) {
        const key = new TextEncoder().encode(this.config.env.SUPABASE_JWT_SECRET);
        const { payload } = await jose.jwtVerify(token, key, {
          issuer: this.config.issuer,
          algorithms: ['HS256'],
        });
        return this.assertClaims(payload);
      }

      if (!this.jwks) {
        this.jwks = jose.createRemoteJWKSet(new URL(this.config.jwksUrl));
      }
      const { payload } = await jose.jwtVerify(token, this.jwks, {
        issuer: this.config.issuer,
      });
      return this.assertClaims(payload);
    } catch {
      throw new UnauthorizedException('Invalid or expired access token');
    }
  }

  private assertClaims(payload: jose.JWTPayload): VerifiedIdentity {
    if (!payload.sub || typeof payload.sub !== 'string') {
      throw new UnauthorizedException('Missing subject');
    }
    if (!payload.exp || typeof payload.exp !== 'number') {
      throw new UnauthorizedException('Missing expiration');
    }
    return { sub: payload.sub, exp: payload.exp };
  }
}
