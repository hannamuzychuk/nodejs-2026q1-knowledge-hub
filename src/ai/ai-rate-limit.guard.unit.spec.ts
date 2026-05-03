import { HttpException } from '@nestjs/common';
import { AiRateLimitGuard } from './ai-rate-limit.guard';

describe('AiRateLimitGuard', () => {
  const previousLimit = process.env.AI_RATE_LIMIT_RPM;

  afterEach(() => {
    if (previousLimit === undefined) {
      delete process.env.AI_RATE_LIMIT_RPM;
    } else {
      process.env.AI_RATE_LIMIT_RPM = previousLimit;
    }
  });

  const createContext = (ip: string, responseHeaders: Record<string, string>) =>
    ({
      switchToHttp: () => ({
        getRequest: () => ({ ip, headers: {} }),
        getResponse: () => ({
          setHeader: (name: string, value: string) => {
            responseHeaders[name] = value;
          },
        }),
      }),
    }) as any;

  it('allows request when under limit', () => {
    process.env.AI_RATE_LIMIT_RPM = '2';
    const guard = new AiRateLimitGuard();
    const headers: Record<string, string> = {};

    expect(guard.canActivate(createContext('127.0.0.1', headers))).toBe(true);
    expect(headers['Retry-After']).toBeUndefined();
  });

  it('throws 429 and sets Retry-After when limit exceeded', () => {
    process.env.AI_RATE_LIMIT_RPM = '1';
    const guard = new AiRateLimitGuard();
    const headers: Record<string, string> = {};

    expect(guard.canActivate(createContext('127.0.0.1', headers))).toBe(true);

    try {
      guard.canActivate(createContext('127.0.0.1', headers));
      throw new Error('Expected guard to throw HttpException');
    } catch (error) {
      expect(error).toBeInstanceOf(HttpException);
      expect((error as HttpException).getStatus()).toBe(429);
      expect(Number(headers['Retry-After'])).toBeGreaterThanOrEqual(1);
    }
  });

  it('falls back to 20 RPM when AI_RATE_LIMIT_RPM is not a positive number', () => {
    process.env.AI_RATE_LIMIT_RPM = 'not-a-number';
    const guard = new AiRateLimitGuard();
    const headers: Record<string, string> = {};
    const ctx = () => createContext('10.20.30.40', headers);

    for (let i = 0; i < 20; i += 1) {
      expect(guard.canActivate(ctx())).toBe(true);
    }

    try {
      guard.canActivate(ctx());
      throw new Error('Expected guard to throw HttpException');
    } catch (error) {
      expect(error).toBeInstanceOf(HttpException);
      expect((error as HttpException).getStatus()).toBe(429);
      expect(Number(headers['Retry-After'])).toBeGreaterThanOrEqual(1);
    }
  });
});
