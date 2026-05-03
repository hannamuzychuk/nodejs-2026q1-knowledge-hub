import { Module } from '@nestjs/common';
import { ArticleModule } from '../article/article.module';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';
import { GeminiService } from './gemini.service';
import { AiCacheService } from './ai-cache.service';
import { AiUsageService } from './ai-usage.service';
import { AiRateLimitGuard } from './ai-rate-limit.guard';

@Module({
  imports: [ArticleModule],
  controllers: [AiController],
  providers: [
    AiService,
    GeminiService,
    AiCacheService,
    AiUsageService,
    AiRateLimitGuard,
  ],
})
export class AiModule {}
