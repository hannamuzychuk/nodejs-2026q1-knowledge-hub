import 'reflect-metadata';
import { vi } from 'vitest';

vi.mock('@prisma/client', () => ({
  PrismaClient: class PrismaClient {},
  Role: {
    ADMIN: 'ADMIN',
    EDITOR: 'EDITOR',
    VIEWER: 'VIEWER',
  },
  Status: {
    DRAFT: 'DRAFT',
    PUBLISHED: 'PUBLISHED',
    ARCHIVED: 'ARCHIVED',
  },
}));
