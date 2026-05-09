import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { UserModule } from './user/user.module';
import { ArticleModule } from './article/article.module';
import { CategoryModule } from './category/category.module';
import { CommentModule } from './comment/comment.module';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { JwtRbacGuard } from './auth/guards/jwt-rbac.guard';
import { AiModule } from './ai/ai.module';
import { RagModule } from './rag/rag.module';

@Module({
  imports: [
    AuthModule,
    UserModule,
    ArticleModule,
    CategoryModule,
    CommentModule,
    PrismaModule,
    AiModule,
    RagModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: JwtRbacGuard,
    },
  ],
})
export class AppModule {}
