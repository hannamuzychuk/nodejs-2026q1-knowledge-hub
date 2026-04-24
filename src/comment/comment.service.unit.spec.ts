import { Test, TestingModule } from '@nestjs/testing';
import {
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { CommentService } from './comment.service';
import { DbService } from 'src/db/db.service';

describe('CommentService', () => {
  let service: CommentService;
  let db: DbService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [CommentService, DbService],
    }).compile();

    service = module.get(CommentService);
    db = module.get(DbService);
  });

  it('creates comment for existing article', () => {
    db.articles.push({
      id: 'a1',
      title: 't',
      content: 'c',
      status: 'draft',
      authorId: null,
      categoryId: null,
      tags: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    const created = service.create({ content: 'Nice', articleId: 'a1' });

    expect(created.articleId).toBe('a1');
    expect(db.comments).toHaveLength(1);
  });

  it('throws when article does not exist', () => {
    expect(() =>
      service.create({ content: 'Nice', articleId: 'missing' }),
    ).toThrow(UnprocessableEntityException);
  });

  it('throws not found for missing comment', () => {
    expect(() => service.findOne('missing')).toThrow(NotFoundException);
  });

  it('filters by articleId', () => {
    db.comments.push(
      {
        id: 'c1',
        content: 'one',
        articleId: 'a1',
        createdAt: Date.now(),
      },
      {
        id: 'c2',
        content: 'two',
        articleId: 'a2',
        createdAt: Date.now(),
      },
    );

    expect(service.findAll({ articleId: 'a1' })).toHaveLength(1);
    expect(service.findAll({})).toHaveLength(2);
  });
});
