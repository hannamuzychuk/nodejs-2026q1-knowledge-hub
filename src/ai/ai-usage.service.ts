import { Injectable } from '@nestjs/common';

type CacheOp = 'summarize' | 'translate';

@Injectable()
export class AiUsageService {
  private totalRequests = 0;
  private readonly requestsByEndpoint = new Map<string, number>();
  private totalTokens = 0;
  private readonly tokensByEndpoint = new Map<string, number>();

  private readonly cacheHits = new Map<CacheOp, number>([
    ['summarize', 0],
    ['translate', 0],
  ]);
  private readonly cacheMisses = new Map<CacheOp, number>([
    ['summarize', 0],
    ['translate', 0],
  ]);
  private readonly latencyMs = new Map<
    string,
    { sum: number; count: number }
  >();

  trackRequest(endpoint: string, tokenUsage?: number) {
    this.totalRequests += 1;
    this.requestsByEndpoint.set(
      endpoint,
      (this.requestsByEndpoint.get(endpoint) || 0) + 1,
    );
    if (typeof tokenUsage === 'number' && Number.isFinite(tokenUsage)) {
      this.totalTokens += tokenUsage;
      this.tokensByEndpoint.set(
        endpoint,
        (this.tokensByEndpoint.get(endpoint) || 0) + tokenUsage,
      );
    }
  }

  recordGeminiLatency(endpoint: string, latencyMs: number) {
    if (!Number.isFinite(latencyMs) || latencyMs < 0) {
      return;
    }
    const prev = this.latencyMs.get(endpoint) || { sum: 0, count: 0 };
    this.latencyMs.set(endpoint, {
      sum: prev.sum + latencyMs,
      count: prev.count + 1,
    });
  }

  recordCacheResult(operation: CacheOp, hit: boolean) {
    const map = hit ? this.cacheHits : this.cacheMisses;
    map.set(operation, (map.get(operation) || 0) + 1);
  }

  snapshot() {
    const latencyByEndpoint: Record<string, { count: number; avgMs: number }> =
      {};
    for (const [endpoint, { sum, count }] of this.latencyMs.entries()) {
      latencyByEndpoint[endpoint] = {
        count,
        avgMs: count > 0 ? Math.round(sum / count) : 0,
      };
    }

    const summarizeHits = this.cacheHits.get('summarize') || 0;
    const summarizeMisses = this.cacheMisses.get('summarize') || 0;
    const translateHits = this.cacheHits.get('translate') || 0;
    const translateMisses = this.cacheMisses.get('translate') || 0;
    const summarizeTotal = summarizeHits + summarizeMisses;
    const translateTotal = translateHits + translateMisses;

    return {
      totalRequests: this.totalRequests,
      requestsByEndpoint: Object.fromEntries(this.requestsByEndpoint.entries()),
      totalTokens: this.totalTokens,
      tokensByEndpoint: Object.fromEntries(this.tokensByEndpoint.entries()),
      observability: {
        cacheHitRatio: {
          summarize: summarizeTotal > 0 ? summarizeHits / summarizeTotal : null,
          translate: translateTotal > 0 ? translateHits / translateTotal : null,
        },
        cacheEvents: {
          summarize: { hits: summarizeHits, misses: summarizeMisses },
          translate: { hits: translateHits, misses: translateMisses },
        },
        geminiLatencyMsByEndpoint: latencyByEndpoint,
      },
    };
  }
}
