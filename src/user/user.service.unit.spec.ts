import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { compare, hash } from 'bcrypt';
import { vi } from 'vitest';
import { UserService } from './user.service';
import { PrismaService } from '../prisma/prisma.service';

vi.mock('bcrypt', () => ({
  compare: vi.fn(),
  hash: vi.fn(),
}));

describe('UserService', () => {
  let service: UserService;
  const prisma = {
    user: {
      create: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    article: { updateMany: vi.fn() },
    $transaction: vi.fn(),
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        {
          provide: UserService,
          useFactory: () => new UserService(prisma as any),
        },
        {
          provide: PrismaService,
          useValue: prisma,
        },
      ],
    }).compile();
    service = module.get(UserService);
  });

  it('hashes password, sets default role and strips password on create', async () => {
    prisma.user.findFirst.mockResolvedValue(null);
    prisma.user.create.mockResolvedValue({
      id: 'u1',
      login: 'john',
      password: 'hashed-pass',
      role: 'VIEWER',
    });
    vi.mocked(hash).mockResolvedValue('hashed-pass' as never);

    const created = await service.create({ login: 'john', password: 'secret123' });

    expect(prisma.user.create).toHaveBeenCalledWith({
      data: { login: 'john', password: 'hashed-pass', role: 'VIEWER' },
    });
    expect(created).toEqual({ id: 'u1', login: 'john', role: 'VIEWER' });
  });

  it('throws bad request when login already exists', async () => {
    prisma.user.findFirst.mockResolvedValue({ id: 'u1', login: 'john' });

    await expect(service.create({ login: 'john', password: 'secret123' })).rejects.toThrow(
      BadRequestException,
    );
  });

  it('throws not found on findOne for missing user', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    await expect(service.findOne('missing')).rejects.toThrow(NotFoundException);
  });

  it('throws forbidden on update when old password does not match', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'u1',
      login: 'john',
      password: 'hashed-pass',
      role: 'VIEWER',
    });
    vi.mocked(compare).mockResolvedValue(false as never);

    await expect(
      service.update('u1', { oldPassword: 'wrong', newPassword: 'new-secret' }),
    ).rejects.toThrow(ForbiddenException);
  });

  it('throws bad request on update when only one password field is provided', async () => {
    await expect(service.update('u1', { oldPassword: 'old-only' })).rejects.toThrow(
      BadRequestException,
    );
  });

  it('archives user articles then deletes user on remove', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'u1', login: 'john' });
    prisma.$transaction.mockImplementation(async (callback: any) =>
      callback({
        article: { updateMany: prisma.article.updateMany },
        user: { delete: prisma.user.delete },
      }),
    );

    await service.remove('u1');

    expect(prisma.article.updateMany).toHaveBeenCalledWith({
      where: { authorId: 'u1' },
      data: { status: 'ARCHIVED' },
    });
    expect(prisma.user.delete).toHaveBeenCalledWith({ where: { id: 'u1' } });
  });
});
