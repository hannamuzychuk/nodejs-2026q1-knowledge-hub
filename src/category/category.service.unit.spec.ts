import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { CategoryService } from './category.service';
import { DbService } from 'src/db/db.service';

describe('CategoryService', () => {
  let service: CategoryService;
  let db: DbService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [CategoryService, DbService],
    }).compile();

    service = module.get(CategoryService);
    db = module.get(DbService);
  });

  it('creates category and returns it', () => {
    const created = service.create({ name: 'Tech', description: 'desc' });

    expect(created.name).toBe('Tech');
    expect(db.categories).toHaveLength(1);
  });

  it('throws not found for missing category', () => {
    expect(() => service.findOne('missing')).toThrow(NotFoundException);
  });

  it('updates category fields', () => {
    const created = service.create({ name: 'Tech', description: 'desc' });
    const updated = service.update(created.id, { description: 'new-desc' });

    expect(updated.description).toBe('new-desc');
  });

  it('removes category and nulls categoryId in articles', () => {
    const created = service.create({ name: 'Tech', description: 'desc' });
    db.articles.push({
      id: 'a1',
      title: 't',
      content: 'c',
      status: 'draft',
      authorId: null,
      categoryId: created.id,
      tags: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    service.remove(created.id);

    expect(db.categories).toHaveLength(0);
    expect(db.articles[0].categoryId).toBeNull();
  });
});
