import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthService } from './auth.service.js';
import type { RequestWithId } from '../common/request-id.middleware.js';

export type AuthenticatedRequest = RequestWithId & {
  auth?: {
    userId: string;
    authSubject: string;
    requestId?: string;
  };
};

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly auth: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing Bearer token');
    }
    const token = header.slice('Bearer '.length).trim();
    if (!token) throw new UnauthorizedException('Missing Bearer token');
    const identity = await this.auth.resolveUserFromAccessToken(token);
    req.auth = {
      userId: identity.userId,
      authSubject: identity.authSubject,
      requestId: req.requestId,
    };
    return true;
  }
}
