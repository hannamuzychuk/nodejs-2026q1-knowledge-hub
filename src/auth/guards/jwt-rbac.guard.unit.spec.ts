import { ExecutionContext, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { vi } from 'vitest';
import { JwtRbacGuard } from './jwt-rbac.guard';
import { PrismaService } from '../../prisma/prisma.service';

describe('JwtRbacGuard', () => {
  const reflector = { getAllAndOverride: vi.fn() } as unknown as Reflector;
  const jwtService = { verifyAsync: vi.fn() } as unknown as JwtService;
  const prisma = {
    article: { findUnique: vi.fn() },
    comment: { findUnique: vi.fn() },
  } as unknown as PrismaService;

  const createContext = (request: any): ExecutionContext =>
    ({
      getHandler: vi.fn(),
      getClass: vi.fn(),
      switchToHttp: () => ({ getRequest: () => request }),
    }) as unknown as ExecutionContext;

  let guard: JwtRbacGuard;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.JWT_SECRET = 'test-access-secret';
    guard = new JwtRbacGuard(reflector, jwtService, prisma);
  });

  it('passes for valid bearer token', async () => {
    const request = {
      headers: { authorization: 'Bearer valid-token' },
      method: 'GET',
      path: '/article',
      params: {},
      body: {},
    };
    reflector.getAllAndOverride = vi.fn().mockReturnValue(false);
    (jwtService.verifyAsync as any).mockResolvedValue({
      userId: 'u1',
      login: 'john',
      role: 'viewer',
    });

    await expect(guard.canActivate(createContext(request))).resolves.toBe(true);
  });

  it('throws unauthorized when authorization header is missing', async () => {
    reflector.getAllAndOverride = vi.fn().mockReturnValue(false);
    await expect(
      guard.canActivate(createContext({ headers: {}, method: 'GET', path: '/article' })),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('throws unauthorized on malformed authorization header', async () => {
    reflector.getAllAndOverride = vi.fn().mockReturnValue(false);
    await expect(
      guard.canActivate(
        createContext({
          headers: { authorization: 'Token abc' },
          method: 'GET',
          path: '/article',
        }),
      ),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('throws unauthorized for expired token', async () => {
    reflector.getAllAndOverride = vi.fn().mockReturnValue(false);
    (jwtService.verifyAsync as any).mockRejectedValue(new Error('expired'));
    await expect(
      guard.canActivate(
        createContext({
          headers: { authorization: 'Bearer expired' },
          method: 'GET',
          path: '/article',
        }),
      ),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('throws forbidden when viewer attempts non-GET operation', async () => {
    reflector.getAllAndOverride = vi.fn().mockReturnValue(false);
    (jwtService.verifyAsync as any).mockResolvedValue({
      userId: 'u1',
      login: 'john',
      role: 'viewer',
    });
    await expect(
      guard.canActivate(
        createContext({
          headers: { authorization: 'Bearer token' },
          method: 'POST',
          path: '/article',
          params: {},
          body: {},
        }),
      ),
    ).rejects.toThrow(ForbiddenException);
  });

  it('allows editor to update own article and blocks other owner', async () => {
    reflector.getAllAndOverride = vi.fn().mockReturnValue(false);
    (jwtService.verifyAsync as any).mockResolvedValue({
      userId: 'editor-1',
      login: 'ed',
      role: 'editor',
    });
    (prisma.article.findUnique as any).mockResolvedValueOnce({ authorId: 'editor-1' });

    await expect(
      guard.canActivate(
        createContext({
          headers: { authorization: 'Bearer token' },
          method: 'PUT',
          path: '/article/1',
          params: { id: '1' },
          body: {},
        }),
      ),
    ).resolves.toBe(true);

    (prisma.article.findUnique as any).mockResolvedValueOnce({ authorId: 'another-user' });
    await expect(
      guard.canActivate(
        createContext({
          headers: { authorization: 'Bearer token' },
          method: 'PUT',
          path: '/article/2',
          params: { id: '2' },
          body: {},
        }),
      ),
    ).rejects.toThrow(ForbiddenException);
  });
});
