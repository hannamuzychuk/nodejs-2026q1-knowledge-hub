import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { ArticleService } from './article.service';
import { DbService } from 'src/db/db.service';
import { ArticleStatus } from './entities/article.entity';

describe('ArticleService', () => {
  let service: ArticleService;
  let db: DbService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ArticleService, DbService],
    }).compile();

    service = module.get(ArticleService);
    db = module.get(DbService);
  });

  it('creates article with defaults', () => {
    const created = service.create({
      title: 'Nest Intro',
      content: 'Body',
    });

    expect(created.status).toBe(ArticleStatus.DRAFT);
    expect(created.tags).toEqual([]);
    expect(db.articles).toHaveLength(1);
  });

  it('filters articles by status, category and tag', () => {
    db.articles.push(
      {
        id: 'a1',
        title: 'one',
        content: 'one',
        status: ArticleStatus.DRAFT,
        authorId: null,
        categoryId: 'cat-1',
        tags: ['node'],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
      {
        id: 'a2',
        title: 'two',
        content: 'two',
        status: ArticleStatus.PUBLISHED,
        authorId: null,
        categoryId: 'cat-2',
        tags: ['nestjs'],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
    );

    expect(service.findAll({ status: ArticleStatus.PUBLISHED })).toHaveLength(1);
    expect(service.findAll({ categoryId: 'cat-1' })).toHaveLength(1);
    expect(service.findAll({ tag: 'nestjs' })).toHaveLength(1);
  });

  it('throws not found when article does not exist', () => {
    expect(() => service.findOne('missing')).toThrow(NotFoundException);
  });

  it('updates existing article', () => {
    const created = service.create({
      title: 'Nest Intro',
      content: 'Body',
      tags: ['backend'],
    });

    const updated = service.update(created.id, {
      status: ArticleStatus.PUBLISHED,
      tags: ['backend', 'api'],
    });

    expect(updated.status).toBe(ArticleStatus.PUBLISHED);
    expect(updated.tags).toEqual(['backend', 'api']);
  });

  it('removes article and linked comments', () => {
    const created = service.create({
      title: 'Nest Intro',
      content: 'Body',
    });
    db.comments.push({
      id: 'c1',
      content: 'Comment',
      articleId: created.id,
      authorId: null,
      createdAt: Date.now(),
    });

    service.remove(created.id);

    expect(db.articles).toHaveLength(0);
    expect(db.comments).toHaveLength(0);
  });
});
