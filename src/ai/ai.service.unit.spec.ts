import { vi } from 'vitest';
import { AiService } from './ai.service';
import { ArticleService } from '../article/article.service';
import { GeminiService } from './gemini.service';
import { AiCacheService } from './ai-cache.service';
import { AiUsageService } from './ai-usage.service';
import { AiConversationService } from './ai-conversation.service';

describe('AiService', () => {
  const article = {
    id: '2f8f6f16-2de2-49bc-95eb-b51f8cf80e2e',
    title: 'Nest article',
    content: 'This is an article content.',
    updatedAt: new Date('2026-05-02T10:00:00.000Z'),
  };

  const articleService = {
    findOne: vi.fn(),
  } as unknown as ArticleService;

  const geminiService = {
    generate: vi.fn(),
    generateWithConversation: vi.fn(),
  } as unknown as GeminiService;

  const cacheService = {
    get: vi.fn(),
    set: vi.fn(),
  } as unknown as AiCacheService;

  const usageService = {
    trackRequest: vi.fn(),
    snapshot: vi.fn(),
    recordCacheResult: vi.fn(),
    recordGeminiLatency: vi.fn(),
  } as unknown as AiUsageService;

  const conversationService = {
    resolveSession: vi.fn(),
    recordExchange: vi.fn(),
    getActiveSessionCount: vi.fn().mockReturnValue(4),
  } as unknown as AiConversationService;

  let service: AiService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new AiService(
      articleService,
      geminiService,
      cacheService,
      usageService,
      conversationService,
    );
    (articleService.findOne as any).mockResolvedValue(article);
    (conversationService.resolveSession as any).mockReturnValue({
      sessionId: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
      priorTurns: [],
    });
  });

  it('returns cached summary when available', async () => {
    const cached = {
      articleId: article.id,
      summary: 'cached summary',
      originalLength: 10,
      summaryLength: 5,
    };
    (cacheService.get as any).mockReturnValue(cached);

    const result = await service.summarizeArticle(article.id, {
      maxLength: 'short',
    });

    expect(result).toEqual(cached);
    expect(geminiService.generate).not.toHaveBeenCalled();
    expect(usageService.recordCacheResult).toHaveBeenCalledWith(
      'summarize',
      true,
    );
  });

  it('generates and caches summary when cache miss', async () => {
    (cacheService.get as any).mockReturnValue(null);
    (geminiService.generate as any).mockResolvedValue({
      text: 'Generated summary',
      tokenUsage: 22,
    });

    const result = await service.summarizeArticle(article.id, {
      maxLength: 'medium',
    });

    expect(result.articleId).toBe(article.id);
    expect(result.summary).toBe('Generated summary');
    expect(cacheService.set).toHaveBeenCalledTimes(1);
    expect(usageService.recordCacheResult).toHaveBeenCalledWith(
      'summarize',
      false,
    );
    expect(usageService.recordGeminiLatency).toHaveBeenCalled();
    expect(usageService.trackRequest).toHaveBeenCalledWith(
      'POST /ai/articles/:articleId/summarize',
      22,
    );
  });

  it('translates article and reads parsed JSON payload', async () => {
    (cacheService.get as any).mockReturnValue(null);
    (geminiService.generate as any).mockResolvedValue({
      text: JSON.stringify({
        translatedText: 'Przetlumaczony tekst',
        detectedLanguage: 'en',
      }),
      tokenUsage: 15,
    });

    const result = await service.translateArticle(article.id, {
      targetLanguage: 'Polish',
    });

    expect(result).toEqual({
      articleId: article.id,
      translatedText: 'Przetlumaczony tekst',
      detectedLanguage: 'en',
    });
    expect(cacheService.set).toHaveBeenCalledTimes(1);
    expect(usageService.recordCacheResult).toHaveBeenCalledWith(
      'translate',
      false,
    );
    expect(usageService.trackRequest).toHaveBeenCalledWith(
      'POST /ai/articles/:articleId/translate',
      15,
    );
  });

  it('analyzes article and falls back to info severity for invalid value', async () => {
    (geminiService.generate as any).mockResolvedValue({
      text: JSON.stringify({
        analysis: 'Looks fine',
        suggestions: ['Add examples'],
        severity: 'critical',
      }),
      tokenUsage: 9,
    });

    const result = await service.analyzeArticle(article.id, {});

    expect(result).toEqual({
      articleId: article.id,
      analysis: 'Looks fine',
      suggestions: ['Add examples'],
      severity: 'info',
    });
    expect(usageService.trackRequest).toHaveBeenCalledWith(
      'POST /ai/articles/:articleId/analyze',
      9,
    );
  });

  it('runs generate with conversation and returns session id', async () => {
    (geminiService.generateWithConversation as any).mockResolvedValue({
      text: 'Hello!',
      tokenUsage: 5,
    });

    const result = await service.generate({
      prompt: 'Hi',
      sessionId: undefined,
    });

    expect(result.output).toBe('Hello!');
    expect(result.sessionId).toBe('aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee');
    expect(geminiService.generateWithConversation).toHaveBeenCalledWith(
      [],
      'Hi',
      undefined,
    );
    expect(conversationService.recordExchange).toHaveBeenCalledWith(
      'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
      'Hi',
      'Hello!',
    );
    expect(usageService.trackRequest).toHaveBeenCalledWith(
      'POST /ai/generate',
      5,
    );
  });

  it('merges usage snapshot with active session count', () => {
    (usageService.snapshot as any).mockReturnValue({
      totalRequests: 3,
      requestsByEndpoint: {},
      totalTokens: 100,
      tokensByEndpoint: {},
      observability: {
        cacheHitRatio: { summarize: null, translate: null },
        cacheEvents: {
          summarize: { hits: 0, misses: 0 },
          translate: { hits: 0, misses: 0 },
        },
        geminiLatencyMsByEndpoint: {},
      },
    });

    expect(service.getUsageSnapshot()).toMatchObject({
      totalRequests: 3,
      observability: {
        activeAiSessions: 4,
        cacheHitRatio: { summarize: null, translate: null },
      },
    });
  });
});
