import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { compare } from 'bcrypt';
import { vi } from 'vitest';
import { AuthService } from './auth.service';
import { UserService } from '../user/user.service';
import {
  ForbiddenError,
  UnauthorizedError,
  ValidationError,
} from '../common/errors/app-error';

vi.mock('bcrypt', () => ({
  compare: vi.fn(),
  hash: vi.fn(),
}));

describe('AuthService', () => {
  let service: AuthService;
  const userService = {
    findByLogin: vi.fn(),
    findById: vi.fn(),
    create: vi.fn(),
  };
  const jwtService = {
    signAsync: vi.fn(),
    verifyAsync: vi.fn(),
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    process.env.JWT_SECRET = 'test-access-secret';
    process.env.JWT_REFRESH_SECRET = 'test-refresh-secret';
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        {
          provide: AuthService,
          useFactory: () =>
            new AuthService(userService as any, jwtService as any),
        },
        { provide: UserService, useValue: userService },
        { provide: JwtService, useValue: jwtService },
      ],
    }).compile();
    service = module.get(AuthService);
  });

  it('assigns VIEWER role on signup', async () => {
    userService.findByLogin.mockResolvedValue(null);
    userService.create.mockResolvedValue({ id: 'u1', role: 'VIEWER' });

    await service.signup({ login: 'john', password: 'secret123' });

    expect(userService.create).toHaveBeenCalledWith(
      expect.objectContaining({ role: 'VIEWER' }),
    );
  });

  it('throws for duplicate login on signup', async () => {
    userService.findByLogin.mockResolvedValue({ id: 'u1', login: 'john' });
    await expect(
      service.signup({ login: 'john', password: 'x' }),
    ).rejects.toThrow(ValidationError);
  });

  it('generates access and refresh token on valid login', async () => {
    userService.findByLogin.mockResolvedValue({
      id: 'u1',
      login: 'john',
      role: 'EDITOR',
      password: 'hashed',
    });
    vi.mocked(compare).mockResolvedValue(true as never);
    jwtService.signAsync
      .mockResolvedValueOnce('access')
      .mockResolvedValueOnce('refresh');

    const result = await service.login({
      login: 'john',
      password: 'secret123',
    });

    expect(result).toEqual({ accessToken: 'access', refreshToken: 'refresh' });
    expect(jwtService.signAsync).toHaveBeenCalledTimes(2);
  });

  it('throws on invalid password in login', async () => {
    userService.findByLogin.mockResolvedValue({
      id: 'u1',
      login: 'john',
      role: 'EDITOR',
      password: 'hashed',
    });
    vi.mocked(compare).mockResolvedValue(false as never);

    await expect(
      service.login({ login: 'john', password: 'bad' }),
    ).rejects.toThrow(ForbiddenError);
  });

  it('rotates refresh token when refresh token is valid', async () => {
    jwtService.verifyAsync.mockResolvedValue({
      userId: 'u1',
      login: 'john',
      role: 'editor',
    });
    userService.findById.mockResolvedValue({
      id: 'u1',
      login: 'john',
      role: 'EDITOR',
    });
    jwtService.signAsync
      .mockResolvedValueOnce('new-access')
      .mockResolvedValueOnce('new-refresh');

    const tokens = await service.refresh({ refreshToken: 'old-refresh' });

    expect(tokens).toEqual({
      accessToken: 'new-access',
      refreshToken: 'new-refresh',
    });
  });

  it('throws for expired or invalid refresh token', async () => {
    jwtService.verifyAsync.mockRejectedValue(new Error('jwt expired'));
    await expect(
      service.refresh({ refreshToken: 'bad-token' }),
    ).rejects.toThrow(ForbiddenError);
  });

  it('throws unauthorized when refresh token is missing', async () => {
    await expect(service.refresh({ refreshToken: '' })).rejects.toThrow(
      UnauthorizedError,
    );
  });
});
