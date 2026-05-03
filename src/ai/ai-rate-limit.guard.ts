import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Injectable()
export class AiRateLimitGuard implements CanActivate {
  private readonly requestsByIp = new Map<string, number[]>();
  private readonly limitPerMinute = this.resolveLimitPerMinute();
  private readonly windowMs = 60_000;

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();
    const now = Date.now();
    const ip = this.resolveIp(request);
    const timestamps = this.requestsByIp.get(ip) || [];
    const fresh = timestamps.filter((timestamp) => now - timestamp < this.windowMs);

    if (fresh.length >= this.limitPerMinute) {
      const oldestAllowed = fresh[0] + this.windowMs;
      const retryAfterSec = Math.max(1, Math.ceil((oldestAllowed - now) / 1000));
      response.setHeader('Retry-After', String(retryAfterSec));
      throw new HttpException(
        `AI rate limit exceeded. Try again in ${retryAfterSec} seconds.`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    fresh.push(now);
    this.requestsByIp.set(ip, fresh);
    return true;
  }

  private resolveIp(req: Request) {
    return (
      req.ip ||
      String(req.headers['x-forwarded-for'] || '')
        .split(',')[0]
        .trim() ||
      'unknown'
    );
  }

  private resolveLimitPerMinute() {
    const parsed = Number(process.env.AI_RATE_LIMIT_RPM || 20);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 20;
  }
}
