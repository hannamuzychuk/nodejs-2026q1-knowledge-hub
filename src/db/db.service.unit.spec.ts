import { Test, TestingModule } from '@nestjs/testing';
import { DbService } from './db.service';

describe('DbService', () => {
  let service: DbService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [DbService],
    }).compile();

    service = module.get(DbService);
  });

  it('starts with empty collections', () => {
    expect(service.users).toEqual([]);
    expect(service.articles).toEqual([]);
    expect(service.categories).toEqual([]);
    expect(service.comments).toEqual([]);
  });
});
