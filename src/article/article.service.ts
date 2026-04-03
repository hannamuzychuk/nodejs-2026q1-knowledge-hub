import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateArticleDto } from './dto/create-article.dto';
import { UpdateArticleDto } from './dto/update-article.dto';
import { Article, ArticleStatus } from './entities/article.entity';
import { randomUUID } from 'crypto';
import { DbService } from 'src/db/db.service';

@Injectable()
export class ArticleService {
 constructor(private readonly db: DbService) {}

  create(dto: CreateArticleDto) {
    const newArticle: Article = {
      id: randomUUID(),
      title: dto.title,
      content: dto.content,
      status: dto.status || ArticleStatus.DRAFT,
      authorId: dto.authorId || null,
      categoryId: dto.categoryId || null,
      tags: dto.tags || [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    this.db.articles.push(newArticle);
    return newArticle;
  }

  findAll(query: any) {
    let articles = [...this.db.articles];
    return articles;
  }

  findOne(id: string) {
    const article = this.db.articles.find(a => a.id === id);
    if (!article) throw new NotFoundException('Article not found');
    return article;
  }

  // update(id: number, updateArticleDto: UpdateArticleDto) {
  //   return `This action updates a #${id} article`;
  // }

  remove(id: string) {
    const index = this.db.articles.findIndex(a => a.id === id);
    if (index === -1) throw new NotFoundException('Article not found');

    this.db.comments = this.db.comments.filter(comment => comment.articleId !== id);

    this.db.articles.splice(index, 1);
  }
}
