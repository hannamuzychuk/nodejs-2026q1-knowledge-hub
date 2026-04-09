import { Module } from '@nestjs/common';
import { CommentService } from './comment.service';
import { CommentController } from './comment.controller';
import { ArticleModule } from 'src/article/article.module';

@Module({
  imports: [ArticleModule],
  controllers: [CommentController],
  providers: [CommentService],
})
export class CommentModule {}
