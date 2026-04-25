import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { vi } from 'vitest';
import { JwtAuthGuard } from './jwt-auth.guard';

describe('JwtAuthGuard', () => {
  const jwtService = { verifyAsync: vi.fn() } as unknown as JwtService;
  const createContext = (request: any): ExecutionContext =>
    ({
      switchToHttp: () => ({ getRequest: () => request }),
    }) as unknown as ExecutionContext;

  let guard: JwtAuthGuard;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.JWT_SECRET = 'test-access-secret';
    guard = new JwtAuthGuard(jwtService);
  });

  it('passes for a valid bearer token', async () => {
    (jwtService.verifyAsync as any).mockResolvedValue({
      userId: 'u1',
      role: 'viewer',
    });
    const request = { headers: { authorization: 'Bearer ok' } };
    await expect(guard.canActivate(createContext(request))).resolves.toBe(true);
  });

  it('throws unauthorized when authorization header is missing', async () => {
    await expect(guard.canActivate(createContext({ headers: {} }))).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('throws unauthorized for malformed authorization header', async () => {
    const request = { headers: { authorization: 'Token nope' } };
    await expect(guard.canActivate(createContext(request))).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('throws unauthorized for expired or tampered token', async () => {
    (jwtService.verifyAsync as any).mockRejectedValue(new Error('expired'));
    const request = { headers: { authorization: 'Bearer bad' } };
    await expect(guard.canActivate(createContext(request))).rejects.toThrow(
      UnauthorizedException,
    );
  });
});
