import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { vi } from 'vitest';
import { RolesGuard } from './roles.guard';
import { ForbiddenError } from '../../common/errors/app-error';

describe('RolesGuard', () => {
  const reflector = { getAllAndOverride: vi.fn() } as unknown as Reflector;
  const createContext = (request: any): ExecutionContext =>
    ({
      getHandler: vi.fn(),
      getClass: vi.fn(),
      switchToHttp: () => ({ getRequest: () => request }),
    }) as unknown as ExecutionContext;

  let guard: RolesGuard;

  beforeEach(() => {
    vi.clearAllMocks();
    guard = new RolesGuard(reflector);
  });

  it('grants access for matching role', () => {
    (reflector.getAllAndOverride as any).mockReturnValue(['ADMIN']);
    const context = createContext({ user: { role: 'ADMIN' } });
    expect(guard.canActivate(context)).toBe(true);
  });

  it('throws forbidden for insufficient role', () => {
    (reflector.getAllAndOverride as any).mockReturnValue(['ADMIN']);
    const context = createContext({ user: { role: 'VIEWER' } });
    expect(() => guard.canActivate(context)).toThrow(ForbiddenError);
  });

  it('throws forbidden when user role is missing and roles are required', () => {
    (reflector.getAllAndOverride as any).mockReturnValue(['ADMIN']);
    const context = createContext({ user: {} });
    expect(() => guard.canActivate(context)).toThrow(ForbiddenError);
  });

  it('allows access when roles metadata is missing', () => {
    (reflector.getAllAndOverride as any).mockReturnValue(undefined);
    const context = createContext({ user: { role: 'VIEWER' } });
    expect(guard.canActivate(context)).toBe(true);
  });
});
