import { Injectable } from '@nestjs/common';
import { ArticleService } from '../article/article.service';
import {
  AnalyzeArticleRequestDto,
  AnalyzeArticleResponseDto,
  severityOptions,
} from './dto/analyze-article.dto';
import {
  SummarizeArticleRequestDto,
  SummarizeArticleResponseDto,
} from './dto/summarize-article.dto';
import {
  TranslateArticleRequestDto,
  TranslateArticleResponseDto,
} from './dto/translate-article.dto';
import {
  buildAnalyzePrompt,
  buildSummarizePrompt,
  buildTranslatePrompt,
} from './prompts/article-prompts';
import { GeminiService } from './gemini.service';
import { AiCacheService } from './ai-cache.service';
import { AiUsageService } from './ai-usage.service';

type JsonMap = Record<string, unknown>;

@Injectable()
export class AiService {
  constructor(
    private readonly articleService: ArticleService,
    private readonly geminiService: GeminiService,
    private readonly cacheService: AiCacheService,
    private readonly usageService: AiUsageService,
  ) {}

  async summarizeArticle(
    articleId: string,
    body: SummarizeArticleRequestDto,
  ): Promise<SummarizeArticleResponseDto> {
    const article = await this.articleService.findOne(articleId);
    const maxLength = body.maxLength || 'medium';
    const cacheKey = this.buildCacheKey('summarize', article.id, article.updatedAt, {
      maxLength,
    });
    const fromCache = this.cacheService.get<SummarizeArticleResponseDto>(cacheKey);
    if (fromCache) {
      return fromCache;
    }

    const prompt = buildSummarizePrompt(article.title, article.content, maxLength);
    const generated = await this.geminiService.generate({ prompt });

    const response: SummarizeArticleResponseDto = {
      articleId: article.id,
      summary: generated.text,
      originalLength: article.content.length,
      summaryLength: generated.text.length,
    };
    this.cacheService.set(cacheKey, response);
    this.usageService.trackRequest('POST /ai/articles/:articleId/summarize', generated.tokenUsage);
    return response;
  }

  async translateArticle(
    articleId: string,
    body: TranslateArticleRequestDto,
  ): Promise<TranslateArticleResponseDto> {
    const article = await this.articleService.findOne(articleId);
    const cacheKey = this.buildCacheKey('translate', article.id, article.updatedAt, {
      targetLanguage: body.targetLanguage,
      sourceLanguage: body.sourceLanguage || '',
    });
    const fromCache = this.cacheService.get<TranslateArticleResponseDto>(cacheKey);
    if (fromCache) {
      return fromCache;
    }

    const prompt = buildTranslatePrompt(
      article.title,
      article.content,
      body.targetLanguage,
      body.sourceLanguage,
    );
    const generated = await this.geminiService.generate({ prompt });
    const parsed = this.parseJson(generated.text);
    const response: TranslateArticleResponseDto = {
      articleId: article.id,
      translatedText: this.readString(parsed, 'translatedText', generated.text),
      detectedLanguage: this.readString(parsed, 'detectedLanguage', 'unknown'),
    };

    this.cacheService.set(cacheKey, response);
    this.usageService.trackRequest('POST /ai/articles/:articleId/translate', generated.tokenUsage);
    return response;
  }

  async analyzeArticle(
    articleId: string,
    body: AnalyzeArticleRequestDto,
  ): Promise<AnalyzeArticleResponseDto> {
    const article = await this.articleService.findOne(articleId);
    const task = body.task || 'review';
    const prompt = buildAnalyzePrompt(article.title, article.content, task);
    const generated = await this.geminiService.generate({ prompt });
    const parsed = this.parseJson(generated.text);

    const severityCandidate = this.readString(parsed, 'severity', 'info');
    const severity = severityOptions.includes(severityCandidate as (typeof severityOptions)[number])
      ? (severityCandidate as 'info' | 'warning' | 'error')
      : 'info';
    const suggestions = this.readArrayOfStrings(parsed, 'suggestions');

    const response: AnalyzeArticleResponseDto = {
      articleId: article.id,
      analysis: this.readString(parsed, 'analysis', generated.text),
      suggestions: suggestions.length > 0 ? suggestions : ['No suggestions returned by AI.'],
      severity,
    };
    this.usageService.trackRequest('POST /ai/articles/:articleId/analyze', generated.tokenUsage);
    return response;
  }

  async generate(prompt: string, systemInstruction?: string) {
    const generated = await this.geminiService.generate({ prompt, systemInstruction });
    this.usageService.trackRequest('POST /ai/generate', generated.tokenUsage);
    return { output: generated.text };
  }

  getUsageSnapshot() {
    return this.usageService.snapshot();
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

  private parseJson(input: string): JsonMap {
    const cleaned = input
      .trim()
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/\s*```$/, '');
    try {
      return JSON.parse(cleaned) as JsonMap;
    } catch {
      return {};
    }
  }

  private readString(source: JsonMap, key: string, fallback: string): string {
    const value = source[key];
    return typeof value === 'string' && value.trim() ? value : fallback;
  }

  private readArrayOfStrings(source: JsonMap, key: string): string[] {
    const value = source[key];
    if (!Array.isArray(value)) {
      return [];
    }
    return value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
  }
}
