import { vi } from 'vitest';
import { AiService } from './ai.service';
import { ArticleService } from '../article/article.service';
import { GeminiService } from './gemini.service';
import { AiCacheService } from './ai-cache.service';
import { AiUsageService } from './ai-usage.service';

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
  } as unknown as GeminiService;

  const cacheService = {
    get: vi.fn(),
    set: vi.fn(),
  } as unknown as AiCacheService;

  const usageService = {
    trackRequest: vi.fn(),
    snapshot: vi.fn(),
  } as unknown as AiUsageService;

  let service: AiService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new AiService(
      articleService,
      geminiService,
      cacheService,
      usageService,
    );
    (articleService.findOne as any).mockResolvedValue(article);
  });

  it('returns cached summary when available', async () => {
    const cached = {
      articleId: article.id,
      summary: 'cached summary',
      originalLength: 10,
      summaryLength: 5,
    };
    (cacheService.get as any).mockReturnValue(cached);

    const result = await service.summarizeArticle(article.id, { maxLength: 'short' });

    expect(result).toEqual(cached);
    expect(geminiService.generate).not.toHaveBeenCalled();
  });

  it('generates and caches summary when cache miss', async () => {
    (cacheService.get as any).mockReturnValue(null);
    (geminiService.generate as any).mockResolvedValue({
      text: 'Generated summary',
      tokenUsage: 22,
    });

    const result = await service.summarizeArticle(article.id, { maxLength: 'medium' });

    expect(result.articleId).toBe(article.id);
    expect(result.summary).toBe('Generated summary');
    expect(cacheService.set).toHaveBeenCalledTimes(1);
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

  it('exposes usage snapshot', () => {
    const snapshot = { totalRequests: 3, requestsByEndpoint: {}, totalTokens: 100 };
    (usageService.snapshot as any).mockReturnValue(snapshot);

    expect(service.getUsageSnapshot()).toEqual(snapshot);
  });
});
