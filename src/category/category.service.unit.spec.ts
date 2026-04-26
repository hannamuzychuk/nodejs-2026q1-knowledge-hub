import { Test, TestingModule } from '@nestjs/testing';
import { vi } from 'vitest';
import { CategoryService } from './category.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotFoundError } from '../common/errors/app-error';

describe('CategoryService', () => {
  let service: CategoryService;
  const prisma = {
    category: {
      create: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    article: { updateMany: vi.fn() },
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        {
          provide: CategoryService,
          useFactory: () => new CategoryService(prisma as any),
        },
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get(CategoryService);
  });

  it('creates category with provided data', async () => {
    prisma.category.create.mockResolvedValue({ id: 'cat1', name: 'Tech' });
    const created = await service.create({ name: 'Tech', description: 'desc' });

    expect(created.name).toBe('Tech');
    expect(prisma.category.create).toHaveBeenCalledWith({
      data: { name: 'Tech', description: 'desc' },
    });
  });

  it('finds all categories with article counters', async () => {
    prisma.category.findMany.mockResolvedValue([]);

    await service.findAll();

    expect(prisma.category.findMany).toHaveBeenCalledWith({
      include: {
        _count: {
          select: {
            articles: true,
          },
        },
      },
    });
  });

  it('throws not found for missing category', async () => {
    prisma.category.findUnique.mockResolvedValue(null);
    await expect(service.findOne('missing')).rejects.toThrow(NotFoundError);
  });

  it('updates category fields', async () => {
    prisma.category.findUnique.mockResolvedValue({ id: 'cat1' });
    prisma.category.update.mockResolvedValue({
      id: 'cat1',
      description: 'new-desc',
    });
    const updated = await service.update('cat1', { description: 'new-desc' });

    expect(updated.description).toBe('new-desc');
  });

  it('removes category and nulls categoryId in related articles', async () => {
    prisma.category.findUnique.mockResolvedValue({ id: 'cat1' });
    prisma.category.delete.mockResolvedValue({ id: 'cat1' });

    await service.remove('cat1');

    expect(prisma.article.updateMany).toHaveBeenCalledWith({
      where: { categoryId: 'cat1' },
      data: { categoryId: null },
    });
    expect(prisma.category.delete).toHaveBeenCalledWith({
      where: { id: 'cat1' },
    });
  });
});
