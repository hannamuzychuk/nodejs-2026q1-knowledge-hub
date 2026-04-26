import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { getJwtAccessSecret } from '../jwt-secrets.util';
import { AuthUser } from '../types/auth-user.type';
import { UnauthorizedError } from '../../common/errors/app-error';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly jwtService: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const authHeader = request?.headers?.authorization;

    if (!authHeader || typeof authHeader !== 'string') {
      throw new UnauthorizedError('Authorization header is required');
    }

    const [scheme, token] = authHeader.split(' ');
    if (scheme !== 'Bearer' || !token) {
      throw new UnauthorizedError('Invalid authorization header format');
    }

    try {
      const payload = await this.jwtService.verifyAsync<AuthUser>(token, {
        secret: getJwtAccessSecret(),
      });
      request.user = payload;
      return true;
    } catch {
      throw new UnauthorizedError('Access token is invalid or expired');
    }
  }
}
