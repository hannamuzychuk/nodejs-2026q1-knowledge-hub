import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { vi } from 'vitest';
import { ArticleService } from './article.service';
import { PrismaService } from '../prisma/prisma.service';

describe('ArticleService', () => {
  let service: ArticleService;
  const prisma = {
    article: {
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
          provide: ArticleService,
          useFactory: () => new ArticleService(prisma as any),
        },
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get(ArticleService);
  });

  it('creates article with default draft status and tags mapping', async () => {
    prisma.article.create.mockResolvedValue({ id: 'a1', status: 'DRAFT', tags: [] });

    await service.create({
      title: 'Nest Intro',
      content: 'Body',
      tags: ['node', 'nest'],
    });

    expect(prisma.article.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'DRAFT',
          tags: {
            connectOrCreate: [
              { where: { name: 'node' }, create: { name: 'node' } },
              { where: { name: 'nest' }, create: { name: 'nest' } },
            ],
          },
        }),
      }),
    );
  });

  it('builds filtering query by status, categoryId and tag', async () => {
    prisma.article.findMany.mockResolvedValue([]);

    await service.findAll({ status: 'PUBLISHED' as any, categoryId: 'cat-1', tag: 'nestjs' });

    expect(prisma.article.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          status: 'PUBLISHED',
          categoryId: 'cat-1',
          tags: { some: { name: 'nestjs' } },
        },
      }),
    );
  });

  it('throws not found when article does not exist', async () => {
    prisma.article.findUnique.mockResolvedValue(null);
    await expect(service.findOne('missing')).rejects.toThrow(NotFoundException);
  });

  it('updates article status transition draft to published', async () => {
    prisma.article.findUnique.mockResolvedValue({ id: 'a1' });
    prisma.article.update.mockResolvedValue({ id: 'a1', status: 'PUBLISHED' });

    const updated = await service.update('a1', {
      status: 'PUBLISHED' as any,
    });

    expect(updated.status).toBe('PUBLISHED');
    expect(prisma.article.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'a1' },
        data: expect.objectContaining({ status: 'PUBLISHED' }),
      }),
    );
  });

  it('updates tags using reset and connectOrCreate', async () => {
    prisma.article.findUnique.mockResolvedValue({ id: 'a1' });
    prisma.article.update.mockResolvedValue({ id: 'a1' });

    await service.update('a1', { tags: ['api', 'backend'] });

    expect(prisma.article.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tags: {
            set: [],
            connectOrCreate: [
              { where: { name: 'api' }, create: { name: 'api' } },
              { where: { name: 'backend' }, create: { name: 'backend' } },
            ],
          },
        }),
      }),
    );
  });

  it('removes existing article', async () => {
    prisma.article.findUnique.mockResolvedValue({ id: 'a1' });
    prisma.article.delete.mockResolvedValue({ id: 'a1' });

    await service.remove('a1');
    expect(prisma.article.delete).toHaveBeenCalledWith({ where: { id: 'a1' } });
  });
});
