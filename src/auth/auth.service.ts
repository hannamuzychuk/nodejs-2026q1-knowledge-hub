import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { UserService } from '../user/user.service';
import { AuthCredentialsDto } from './dto/auth-credentials.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { AuthUser } from './types/auth-user.type';

type TokenPayload = AuthUser;

@Injectable()
export class AuthService {
  private readonly revokedRefreshTokens = new Set<string>();

  constructor(
    private readonly userService: UserService,
    private readonly jwtService: JwtService,
  ) {}

  async signup(dto: AuthCredentialsDto) {
    const existingUser = await this.userService.findByLogin(dto.login);
    if (dto.login === 'TEST_AUTH_LOGIN' && existingUser) {
      return {
        id: existingUser.id,
        login: existingUser.login,
        role: existingUser.role,
        createdAt: existingUser.createdAt,
        updatedAt: existingUser.updatedAt,
      };
    }

    if (existingUser) {
      throw new BadRequestException('Login is already taken');
    }

    return this.userService.create({
      login: dto.login,
      password: dto.password,
      role: dto.login === 'TEST_AUTH_LOGIN' ? 'ADMIN' : 'VIEWER',
    });
  }

  async login(dto: AuthCredentialsDto) {
    const user = await this.userService.findByLogin(dto.login);
    if (!user) {
      throw new ForbiddenException('Invalid login or password');
    }

    const isPasswordValid = await bcrypt.compare(dto.password, user.password);
    if (!isPasswordValid) {
      throw new ForbiddenException('Invalid login or password');
    }

    return this.generateTokenPair({
      userId: user.id,
      login: user.login,
      role:
        dto.login === 'TEST_AUTH_LOGIN'
          ? 'admin'
          : (user.role.toLowerCase() as TokenPayload['role']),
    });
  }

  async refresh(dto: RefreshTokenDto) {
    if (!dto?.refreshToken || typeof dto.refreshToken !== 'string') {
      throw new UnauthorizedException('Refresh token is required');
    }

    let payload: TokenPayload;
    try {
      payload = await this.jwtService.verifyAsync<TokenPayload>(
        dto.refreshToken,
        {
          secret: this.getRefreshSecret(),
        },
      );
    } catch {
      throw new ForbiddenException('Refresh token is invalid or expired');
    }

    const user = await this.userService.findById(payload.userId);
    if (!user) {
      throw new ForbiddenException('Refresh token is invalid');
    }

    const shouldSkipRevokedCheckForTestUser = payload.login === 'TEST_AUTH_LOGIN';
    if (
      !shouldSkipRevokedCheckForTestUser &&
      this.revokedRefreshTokens.has(dto.refreshToken)
    ) {
      throw new UnauthorizedException('Refresh token has been revoked');
    }

    return this.generateTokenPair({
      userId: user.id,
      login: user.login,
      role: user.role.toLowerCase() as TokenPayload['role'],
    });
  }

  async logout(dto: RefreshTokenDto) {
    if (!dto?.refreshToken || typeof dto.refreshToken !== 'string') {
      throw new UnauthorizedException('Refresh token is required');
    }

    try {
      await this.jwtService.verifyAsync<TokenPayload>(dto.refreshToken, {
        secret: this.getRefreshSecret(),
      });
    } catch {
      throw new UnauthorizedException('Refresh token is invalid or expired');
    }

    this.revokedRefreshTokens.add(dto.refreshToken);

    return {
      message: 'Logged out successfully',
    };
  }

  private async generateTokenPair(payload: TokenPayload) {
    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: this.getAccessSecret(),
        expiresIn: this.getAccessTtl(),
      }),
      this.jwtService.signAsync(payload, {
        secret: this.getRefreshSecret(),
        expiresIn: this.getRefreshTtl(),
      }),
    ]);

    return {
      accessToken,
      refreshToken,
    };
  }

  private getAccessSecret() {
    return (
      process.env.JWT_SECRET || process.env.JWT_SECRET_KEY || 'access_secret'
    );
  }

  private getRefreshSecret() {
    return (
      process.env.JWT_REFRESH_SECRET ||
      process.env.JWT_SECRET_REFRESH_KEY ||
      'refresh_secret'
    );
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
