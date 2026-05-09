import { describe, expect, it, vi } from 'vitest';
import { RagService } from './rag.service';

describe('RagService reindex', () => {
  const makeService = () => {
    const chunker = {
      chunkText: vi.fn(),
    };
    const embeddings = {
      embedTexts: vi.fn(),
    };
    const qdrant = {
      getCollectionName: vi.fn().mockReturnValue('knowledge_hub_articles'),
      deleteByArticleId: vi.fn().mockResolvedValue(1),
      ensureCollection: vi.fn().mockResolvedValue(undefined),
      upsertChunks: vi.fn().mockResolvedValue(undefined),
    };
    const prisma = {
      article: {
        findMany: vi.fn(),
      },
    };
    const service = new RagService(
      chunker as any,
      embeddings as any,
      qdrant as any,
      prisma as any,
    );
    return { service, chunker, embeddings, qdrant, prisma };
  };

  it('returns zero counters when no articles match filter', async () => {
    const { service, prisma, qdrant } = makeService();
    prisma.article.findMany.mockResolvedValue([]);

    const out = await service.reindex({});

    expect(prisma.article.findMany).toHaveBeenCalled();
    expect(out).toEqual({
      indexedArticles: 0,
      indexedChunks: 0,
      vectorCollection: 'knowledge_hub_articles',
    });
    expect(qdrant.ensureCollection).not.toHaveBeenCalled();
  });

  it('indexes published articles by default with deterministic point ids', async () => {
    const { service, prisma, chunker, embeddings, qdrant } = makeService();
    prisma.article.findMany.mockResolvedValue([
      {
        id: 'a1',
        title: 'Auth',
        content: 'abcdef',
        status: 'PUBLISHED',
        category: { id: 'c1' },
        tags: [{ name: 'jwt' }],
      },
    ]);
    chunker.chunkText.mockReturnValue([
      { index: 0, content: 'abc' },
      { index: 1, content: 'def' },
    ]);
    embeddings.embedTexts.mockResolvedValue([
      [0.1, 0.2],
      [0.3, 0.4],
    ]);

    const out = await service.reindex({});

    expect(prisma.article.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: 'PUBLISHED' }),
      }),
    );
    expect(qdrant.deleteByArticleId).toHaveBeenCalledWith('a1');
    expect(qdrant.ensureCollection).toHaveBeenCalledWith(2);
    expect(qdrant.upsertChunks).toHaveBeenCalledWith([
      expect.objectContaining({ id: 'a1:0' }),
      expect.objectContaining({ id: 'a1:1' }),
    ]);
    expect(out).toEqual({
      indexedArticles: 1,
      indexedChunks: 2,
      vectorCollection: 'knowledge_hub_articles',
    });
  });

  it('respects onlyPublished=false and selective articleIds', async () => {
    const { service, prisma, chunker, embeddings } = makeService();
    prisma.article.findMany.mockResolvedValue([
      {
        id: 'a2',
        title: 'Draft article',
        content: 'xyz',
        status: 'DRAFT',
        category: null,
        tags: [],
      },
    ]);
    chunker.chunkText.mockReturnValue([{ index: 0, content: 'xyz' }]);
    embeddings.embedTexts.mockResolvedValue([[0.9, 0.8, 0.7]]);

    await service.reindex({ onlyPublished: false, articleIds: ['a2'] });

    expect(prisma.article.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: { in: ['a2'] },
          status: undefined,
        },
      }),
    );
  });
});
