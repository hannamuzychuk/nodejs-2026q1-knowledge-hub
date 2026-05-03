import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import {
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
  ApiTooManyRequestsResponse,
} from '@nestjs/swagger';
import { AiService } from './ai.service';
import {
  SummarizeArticleRequestDto,
  SummarizeArticleResponseDto,
} from './dto/summarize-article.dto';
import {
  TranslateArticleRequestDto,
  TranslateArticleResponseDto,
} from './dto/translate-article.dto';
import {
  AnalyzeArticleRequestDto,
  AnalyzeArticleResponseDto,
} from './dto/analyze-article.dto';
import {
  ArticleIdParamDto,
  swaggerExampleArticleId,
} from './dto/article-id-param.dto';
import { AiRateLimitGuard } from './ai-rate-limit.guard';
import { GenerateRequestDto, GenerateResponseDto } from './dto/generate.dto';

@ApiTags('ai')
@UseGuards(AiRateLimitGuard)
@Controller('ai')
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Post('articles/:articleId/summarize')
  @ApiOperation({ summary: 'Summarize an existing article' })
  @ApiBody({ type: SummarizeArticleRequestDto, required: false })
  @ApiResponse({ status: 200, type: SummarizeArticleResponseDto })
  @ApiResponse({ status: 404, description: 'Article not found' })
  @ApiTooManyRequestsResponse({ description: 'AI rate limit exceeded' })
  summarizeArticle(
    @Param() params: ArticleIdParamDto,
    @Body() body: SummarizeArticleRequestDto,
  ) {
    return this.aiService.summarizeArticle(params.articleId, body || {});
  }

  @Post('articles/:articleId/translate')
  @ApiOperation({ summary: 'Translate an existing article' })
  @ApiParam({
    name: 'articleId',
    example: swaggerExampleArticleId,
    description:
      'Article UUID — copy a real `id` from GET /article (example value is format-only until replaced).',
  })
  @ApiBody({ type: TranslateArticleRequestDto })
  @ApiResponse({ status: 200, type: TranslateArticleResponseDto })
  @ApiResponse({ status: 400, description: 'Invalid request' })
  @ApiResponse({ status: 404, description: 'Article not found' })
  @ApiTooManyRequestsResponse({ description: 'AI rate limit exceeded' })
  translateArticle(
    @Param() params: ArticleIdParamDto,
    @Body() body: TranslateArticleRequestDto,
  ) {
    return this.aiService.translateArticle(params.articleId, body);
  }

  @Post('articles/:articleId/analyze')
  @ApiOperation({ summary: 'Analyze article content and suggestions' })
  @ApiParam({
    name: 'articleId',
    example: swaggerExampleArticleId,
    description:
      'Article UUID — copy a real `id` from GET /article (example value is format-only until replaced).',
  })
  @ApiBody({ type: AnalyzeArticleRequestDto, required: false })
  @ApiResponse({ status: 200, type: AnalyzeArticleResponseDto })
  @ApiResponse({ status: 404, description: 'Article not found' })
  @ApiTooManyRequestsResponse({ description: 'AI rate limit exceeded' })
  analyzeArticle(
    @Param() params: ArticleIdParamDto,
    @Body() body: AnalyzeArticleRequestDto,
  ) {
    return this.aiService.analyzeArticle(params.articleId, body || {});
  }

  @Post('generate')
  @ApiOperation({ summary: 'Generate free-form content with Gemini' })
  @ApiBody({ type: GenerateRequestDto })
  @ApiResponse({ status: 200, type: GenerateResponseDto })
  @ApiTooManyRequestsResponse({ description: 'AI rate limit exceeded' })
  generate(@Body() body: GenerateRequestDto) {
    return this.aiService.generate(body);
  }

  @Get('usage')
  @ApiOperation({ summary: 'Get in-memory AI usage snapshot' })
  @ApiResponse({ status: 200, description: 'Usage snapshot' })
  getUsage() {
    return this.aiService.getUsageSnapshot();
  }
}
