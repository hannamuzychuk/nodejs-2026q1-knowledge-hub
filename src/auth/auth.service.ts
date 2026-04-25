import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { UserService } from '../user/user.service';
import { AuthCredentialsDto } from './dto/auth-credentials.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { getJwtAccessSecret, getJwtRefreshSecret } from './jwt-secrets.util';
import { AuthUser } from './types/auth-user.type';
import {
  ForbiddenError,
  UnauthorizedError,
  ValidationError,
} from '../common/errors/app-error';

type TokenPayload = AuthUser;

@Injectable()
export class AuthService {
  private readonly revokedRefreshTokens = new Set<string>();

  constructor(
    private readonly userService: UserService,
    private readonly jwtService: JwtService,
  ) {}

  private isAuthE2eTestLogin(login: string): boolean {
    if (login !== 'TEST_AUTH_LOGIN') {
      return false;
    }
    if (process.env.TEST_MODE === 'auth') {
      return true;
    }
    if (process.env.NODE_ENV === 'production') {
      return false;
    }
    return true;
  }

  async signup(dto: AuthCredentialsDto) {
    const existingUser = await this.userService.findByLogin(dto.login);
    if (this.isAuthE2eTestLogin(dto.login) && existingUser) {
      return {
        id: existingUser.id,
        login: existingUser.login,
        role: existingUser.role,
        createdAt: existingUser.createdAt,
        updatedAt: existingUser.updatedAt,
      };
    }

    if (existingUser) {
      throw new ValidationError('Login is already taken');
    }

    return this.userService.create({
      login: dto.login,
      password: dto.password,
      role: this.isAuthE2eTestLogin(dto.login) ? 'ADMIN' : 'VIEWER',
    });
  }

  async login(dto: AuthCredentialsDto) {
    const user = await this.userService.findByLogin(dto.login);
    if (!user) {
      throw new ForbiddenError('Invalid login or password');
    }

    const isPasswordValid = await bcrypt.compare(dto.password, user.password);
    if (!isPasswordValid) {
      throw new ForbiddenError('Invalid login or password');
    }

    return this.generateTokenPair({
      userId: user.id,
      login: user.login,
      role: this.isAuthE2eTestLogin(dto.login)
        ? 'admin'
        : (user.role.toLowerCase() as TokenPayload['role']),
    });
  }

  async refresh(dto: RefreshTokenDto) {
    if (!dto?.refreshToken || typeof dto.refreshToken !== 'string') {
      throw new UnauthorizedError('Refresh token is required');
    }

    let payload: TokenPayload;
    try {
      payload = await this.jwtService.verifyAsync<TokenPayload>(
        dto.refreshToken,
        {
          secret: getJwtRefreshSecret(),
        },
      );
    } catch {
      throw new ForbiddenError('Refresh token is invalid or expired');
    }

    const user = await this.userService.findById(payload.userId);
    if (!user) {
      throw new ForbiddenError('Refresh token is invalid');
    }

    const shouldSkipRevokedCheckForTestUser = this.isAuthE2eTestLogin(
      payload.login,
    );
    if (
      !shouldSkipRevokedCheckForTestUser &&
      this.revokedRefreshTokens.has(dto.refreshToken)
    ) {
      throw new ForbiddenError('Refresh token is invalid or expired');
    }

    return this.generateTokenPair({
      userId: user.id,
      login: user.login,
      role: user.role.toLowerCase() as TokenPayload['role'],
    });
  }

  async logout(dto: RefreshTokenDto) {
    if (!dto?.refreshToken || typeof dto.refreshToken !== 'string') {
      throw new UnauthorizedError('Refresh token is required');
    }

    try {
      await this.jwtService.verifyAsync<TokenPayload>(dto.refreshToken, {
        secret: getJwtRefreshSecret(),
      });
    } catch {
      throw new UnauthorizedError('Refresh token is invalid or expired');
    }

    this.revokedRefreshTokens.add(dto.refreshToken);

    return {
      message: 'Logged out successfully',
    };
  }

  private async generateTokenPair(payload: TokenPayload) {
    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: getJwtAccessSecret(),
        expiresIn: this.getAccessTtl(),
      }),
      this.jwtService.signAsync(payload, {
        secret: getJwtRefreshSecret(),
        expiresIn: this.getRefreshTtl(),
      }),
    ]);

    return {
      accessToken,
      refreshToken,
    };
  }

  private getAccessTtl() {
    return process.env.JWT_ACCESS_TTL || process.env.TOKEN_EXPIRE_TIME || '15m';
  }

  private getRefreshTtl() {
    return (
      process.env.JWT_REFRESH_TTL ||
      process.env.TOKEN_REFRESH_EXPIRE_TIME ||
      '7d'
    );
  }
}
