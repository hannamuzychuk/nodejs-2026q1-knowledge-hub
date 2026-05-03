import { Injectable } from '@nestjs/common';

type CacheEntry<T> = {
  value: T;
  expiresAt: number;
};

@Injectable()
export class AiCacheService {
  private readonly ttlSec = this.resolveTtlSec();
  private readonly cache = new Map<string, CacheEntry<unknown>>();

  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) {
      return null;
    }
    if (Date.now() >= entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }
    return entry.value as T;
  }

  set<T>(key: string, value: T) {
    this.cache.set(key, {
      value,
      expiresAt: Date.now() + this.ttlSec * 1000,
    });
  }

  private resolveTtlSec() {
    const parsed = Number(process.env.AI_CACHE_TTL_SEC || 300);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 300;
  }
}
