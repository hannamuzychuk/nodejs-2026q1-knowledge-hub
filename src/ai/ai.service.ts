import { Injectable } from '@nestjs/common';
import { ArticleService } from '../article/article.service';
import {
  AnalyzeArticleRequestDto,
  AnalyzeArticleResponseDto,
} from './dto/analyze-article.dto';
import {
  SummarizeArticleRequestDto,
  SummarizeArticleResponseDto,
} from './dto/summarize-article.dto';
import {
  TranslateArticleRequestDto,
  TranslateArticleResponseDto,
} from './dto/translate-article.dto';
import { GenerateRequestDto } from './dto/generate.dto';
import {
  buildAnalyzePrompt,
  buildSummarizePrompt,
  buildTranslatePrompt,
} from './prompts/article-prompts';
import { GeminiService } from './gemini.service';
import { AiCacheService } from './ai-cache.service';
import { AiUsageService } from './ai-usage.service';
import { AiConversationService } from './ai-conversation.service';
import {
  normalizeSummarizeOutput,
  validateAnalyzeStructured,
  validateTranslateStructured,
} from './validation/structured-ai-output';

type JsonMap = Record<string, unknown>;

@Injectable()
export class AiService {
  constructor(
    private readonly articleService: ArticleService,
    private readonly geminiService: GeminiService,
    private readonly cacheService: AiCacheService,
    private readonly usageService: AiUsageService,
    private readonly conversationService: AiConversationService,
  ) {}

  async summarizeArticle(
    articleId: string,
    body: SummarizeArticleRequestDto,
  ): Promise<SummarizeArticleResponseDto> {
    const article = await this.articleService.findOne(articleId);
    const maxLength = body.maxLength || 'medium';
    const cacheKey = this.buildCacheKey(
      'summarize',
      article.id,
      article.updatedAt,
      {
        maxLength,
      },
    );
    const fromCache =
      this.cacheService.get<SummarizeArticleResponseDto>(cacheKey);
    if (fromCache) {
      this.usageService.recordCacheResult('summarize', true);
      return fromCache;
    }
    this.usageService.recordCacheResult('summarize', false);

    const prompt = buildSummarizePrompt(
      article.title,
      article.content,
      maxLength,
    );
    const endpoint = 'POST /ai/articles/:articleId/summarize';
    const t0 = Date.now();
    const generated = await this.geminiService.generate({ prompt });
    this.usageService.recordGeminiLatency(endpoint, Date.now() - t0);

    const summaryText = normalizeSummarizeOutput(generated.text);
    const response: SummarizeArticleResponseDto = {
      articleId: article.id,
      summary: summaryText,
      originalLength: article.content.length,
      summaryLength: summaryText.length,
    };
    this.cacheService.set(cacheKey, response);
    this.usageService.trackRequest(endpoint, generated.tokenUsage);
    return response;
  }

  async translateArticle(
    articleId: string,
    body: TranslateArticleRequestDto,
  ): Promise<TranslateArticleResponseDto> {
    const article = await this.articleService.findOne(articleId);
    const cacheKey = this.buildCacheKey(
      'translate',
      article.id,
      article.updatedAt,
      {
        targetLanguage: body.targetLanguage,
        sourceLanguage: body.sourceLanguage || '',
      },
    );
    const fromCache =
      this.cacheService.get<TranslateArticleResponseDto>(cacheKey);
    if (fromCache) {
      this.usageService.recordCacheResult('translate', true);
      return fromCache;
    }
    this.usageService.recordCacheResult('translate', false);

    const prompt = buildTranslatePrompt(
      article.title,
      article.content,
      body.targetLanguage,
      body.sourceLanguage,
    );
    const endpoint = 'POST /ai/articles/:articleId/translate';
    const t0 = Date.now();
    const generated = await this.geminiService.generate({ prompt });
    this.usageService.recordGeminiLatency(endpoint, Date.now() - t0);

    const structured = validateTranslateStructured(generated.text);
    const response: TranslateArticleResponseDto = {
      articleId: article.id,
      translatedText: structured.translatedText,
      detectedLanguage: structured.detectedLanguage,
    };

    this.cacheService.set(cacheKey, response);
    this.usageService.trackRequest(endpoint, generated.tokenUsage);
    return response;
  }

  async analyzeArticle(
    articleId: string,
    body: AnalyzeArticleRequestDto,
  ): Promise<AnalyzeArticleResponseDto> {
    const article = await this.articleService.findOne(articleId);
    const task = body.task || 'review';
    const prompt = buildAnalyzePrompt(article.title, article.content, task);
    const endpoint = 'POST /ai/articles/:articleId/analyze';
    const t0 = Date.now();
    const generated = await this.geminiService.generate({ prompt });
    this.usageService.recordGeminiLatency(endpoint, Date.now() - t0);

    const structured = validateAnalyzeStructured(generated.text);

    const response: AnalyzeArticleResponseDto = {
      articleId: article.id,
      analysis: structured.analysis,
      suggestions: structured.suggestions,
      severity: structured.severity,
    };
    this.usageService.trackRequest(endpoint, generated.tokenUsage);
    return response;
  }

  async generate(body: GenerateRequestDto) {
    const { sessionId, priorTurns } = this.conversationService.resolveSession(
      body.sessionId,
    );
    const endpoint = 'POST /ai/generate';
    const t0 = Date.now();
    const generated = await this.geminiService.generateWithConversation(
      priorTurns,
      body.prompt,
      body.systemInstruction,
    );
    this.usageService.recordGeminiLatency(endpoint, Date.now() - t0);
    this.conversationService.recordExchange(
      sessionId,
      body.prompt,
      generated.text,
    );
    this.usageService.trackRequest(endpoint, generated.tokenUsage);
    return { output: generated.text, sessionId };
  }

  getUsageSnapshot() {
    const snap = this.usageService.snapshot();
    return {
      ...snap,
      observability: {
        ...snap.observability,
        activeAiSessions: this.conversationService.getActiveSessionCount(),
      },
    };
  }

  private buildCacheKey(
    operation: string,
    articleId: string,
    updatedAt: Date,
    requestParams: JsonMap,
  ) {
    return JSON.stringify({
      operation,
      articleId,
      updatedAt: updatedAt.toISOString(),
      requestParams,
    });
  }
}
