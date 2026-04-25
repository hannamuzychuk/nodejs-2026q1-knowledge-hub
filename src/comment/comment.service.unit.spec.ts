import { Test, TestingModule } from '@nestjs/testing';
import { UnprocessableEntityException } from '@nestjs/common';
import { vi } from 'vitest';
import { CommentService } from './comment.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotFoundError } from '../common/errors/app-error';

describe('CommentService', () => {
  let service: CommentService;
  const prisma = {
    article: { findUnique: vi.fn() },
    user: { findUnique: vi.fn() },
    comment: {
      create: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        {
          provide: CommentService,
          useFactory: () => new CommentService(prisma as any),
        },
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get(CommentService);
  });

  it('creates comment for existing article', async () => {
    prisma.article.findUnique.mockResolvedValue({ id: 'a1' });
    prisma.comment.create.mockResolvedValue({ id: 'c1', articleId: 'a1' });

    const created = await service.create({ content: 'Nice', articleId: 'a1' });

    expect(created.articleId).toBe('a1');
    expect(prisma.comment.create).toHaveBeenCalledWith({
      data: { content: 'Nice', articleId: 'a1', authorId: undefined },
    });
  });

  it('throws when article does not exist', async () => {
    prisma.article.findUnique.mockResolvedValue(null);
    await expect(
      service.create({ content: 'Nice', articleId: 'missing' }),
    ).rejects.toThrow(UnprocessableEntityException);
  });

  it('throws when author does not exist', async () => {
    prisma.article.findUnique.mockResolvedValue({ id: 'a1' });
    prisma.user.findUnique.mockResolvedValue(null);
    await expect(
      service.create({
        content: 'Nice',
        articleId: 'a1',
        authorId: 'u-missing',
      }),
    ).rejects.toThrow(UnprocessableEntityException);
  });

  it('throws not found for missing comment', async () => {
    prisma.comment.findUnique.mockResolvedValue(null);
    await expect(service.findOne('missing')).rejects.toThrow(NotFoundError);
  });

  it('filters by articleId', async () => {
    prisma.comment.findMany.mockResolvedValue([]);
    await service.findAll({ articleId: 'a1' });
    expect(prisma.comment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { articleId: 'a1' } }),
    );
  });
});
