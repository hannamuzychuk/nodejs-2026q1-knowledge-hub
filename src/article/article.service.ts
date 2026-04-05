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

  findAll(query: { status?: string; categoryId?: string; tag?: string }) {
    let articles = [...this.db.articles];

    if (query.status) {
      articles = articles.filter((a) => a.status === query.status);
    }
    if (query.categoryId) {
      articles = articles.filter((a) => a.categoryId === query.categoryId);
    }
    if (query.tag) {
      articles = articles.filter((a) => a.tags.includes(query.tag));
    }

    return articles;
  }

  findOne(id: string) {
    const article = this.db.articles.find((a) => a.id === id);
    if (!article) throw new NotFoundException('Article not found');
    return article;
  }

  update(id: string, dto: UpdateArticleDto) {
    const article = this.findOne(id);

    Object.assign(article, dto);
    article.updatedAt = Date.now();

    return article;
  }

  remove(id: string) {
    const index = this.db.articles.findIndex((a) => a.id === id);
    if (index === -1) throw new NotFoundException('Article not found');

    this.db.comments = this.db.comments.filter(
      (comment) => comment.articleId !== id,
    );

    this.db.articles.splice(index, 1);
  }
}
