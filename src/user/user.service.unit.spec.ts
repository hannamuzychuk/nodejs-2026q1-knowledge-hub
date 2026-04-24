import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { UserService } from './user.service';
import { DbService } from 'src/db/db.service';
import { UserRole } from './entities/user.entity';

describe('UserService', () => {
  let service: UserService;
  let db: DbService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [UserService, DbService],
    }).compile();

    service = module.get(UserService);
    db = module.get(DbService);
  });

  it('creates user with default viewer role and hidden password', () => {
    const created = service.create({ login: 'john', password: 'secret123' });

    expect(created.role).toBe(UserRole.VIEWER);
    expect(created).not.toHaveProperty('password');
    expect(db.users).toHaveLength(1);
  });

  it('keeps explicitly provided role', () => {
    const created = service.create({
      login: 'admin-user',
      password: 'secret123',
      role: UserRole.ADMIN,
    });

    expect(created.role).toBe(UserRole.ADMIN);
  });

  it('throws not found when user does not exist', () => {
    expect(() => service.findOne('missing-id')).toThrow(NotFoundException);
  });

  it('throws bad request when update password payload is incomplete', () => {
    const created = service.create({ login: 'john', password: 'secret123' });

    expect(() =>
      service.update(created.id, { oldPassword: 'secret123' }),
    ).toThrow(BadRequestException);
  });

  it('throws forbidden when old password is wrong', () => {
    const created = service.create({ login: 'john', password: 'secret123' });

    expect(() =>
      service.update(created.id, {
        oldPassword: 'wrong-pass',
        newPassword: 'newSecret',
      }),
    ).toThrow(ForbiddenException);
  });

  it('removes user and clears user relations', () => {
    const created = service.create({ login: 'john', password: 'secret123' });
    db.articles.push({
      id: 'a1',
      title: 'title',
      content: 'content',
      status: 'draft',
      authorId: created.id,
      categoryId: null,
      tags: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    db.comments.push({
      id: 'c1',
      content: 'content',
      articleId: 'a1',
      authorId: created.id,
      createdAt: Date.now(),
    });

    service.remove(created.id);

    expect(db.users).toHaveLength(0);
    expect(db.articles[0].authorId).toBeNull();
    expect(db.comments).toHaveLength(0);
  });
});
