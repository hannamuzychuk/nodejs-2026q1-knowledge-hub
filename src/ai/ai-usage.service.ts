import { Injectable } from '@nestjs/common';

@Injectable()
export class AiUsageService {
  private totalRequests = 0;
  private readonly requestsByEndpoint = new Map<string, number>();
  private totalTokens = 0;

  trackRequest(endpoint: string, tokenUsage?: number) {
    this.totalRequests += 1;
    this.requestsByEndpoint.set(
      endpoint,
      (this.requestsByEndpoint.get(endpoint) || 0) + 1,
    );
    if (typeof tokenUsage === 'number' && Number.isFinite(tokenUsage)) {
      this.totalTokens += tokenUsage;
    }
  }

  snapshot() {
    return {
      totalRequests: this.totalRequests,
      requestsByEndpoint: Object.fromEntries(this.requestsByEndpoint.entries()),
      totalTokens: this.totalTokens,
    };
  }
}
