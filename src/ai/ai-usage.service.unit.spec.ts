import { AiUsageService } from './ai-usage.service';

describe('AiUsageService', () => {
  it('snapshot exposes totals, per-endpoint request counts, and optional token totals', () => {
    const usage = new AiUsageService();
    usage.trackRequest('POST /ai/generate');
    usage.trackRequest('POST /ai/generate', 10);
    usage.trackRequest('POST /ai/articles/x/summarize', 5);

    const snap = usage.snapshot();
    expect(snap.totalRequests).toBe(3);
    expect(snap.requestsByEndpoint).toEqual({
      'POST /ai/generate': 2,
      'POST /ai/articles/x/summarize': 1,
    });
    expect(snap.totalTokens).toBe(15);
    expect(snap.tokensByEndpoint).toEqual({
      'POST /ai/generate': 10,
      'POST /ai/articles/x/summarize': 5,
    });
  });

  it('ignores non-finite token usage for token counters', () => {
    const usage = new AiUsageService();
    usage.trackRequest('POST /ai/generate', Number.NaN);
    usage.trackRequest('POST /ai/generate', Infinity as unknown as number);

    const snap = usage.snapshot();
    expect(snap.totalRequests).toBe(2);
    expect(snap.totalTokens).toBe(0);
    expect(snap.tokensByEndpoint).toEqual({});
  });
});
