import { describe, expect, it, vi } from 'vitest';
import { RagService } from './rag.service';

describe('RagService', () => {
  const makeService = () => {
    const chunker = {
      chunkText: vi.fn(),
    };
    const embeddings = {
      embedText: vi.fn(),
      embedTexts: vi.fn(),
    };
    const qdrant = {
      getCollectionName: vi.fn().mockReturnValue('knowledge_hub_articles'),
      deleteByArticleId: vi.fn().mockResolvedValue(1),
      ensureCollection: vi.fn().mockResolvedValue(undefined),
      upsertChunks: vi.fn().mockResolvedValue(undefined),
      search: vi.fn().mockResolvedValue([]),
    };
    const gemini = {
      generate: vi.fn().mockResolvedValue({ text: 'Grounded answer' }),
      generateWithConversation: vi
        .fn()
        .mockResolvedValue({ text: 'Grounded answer' }),
    };
    const prisma = {
      article: {
        findMany: vi.fn(),
        findUnique: vi.fn(),
      },
    };
    const service = new RagService(
      chunker as any,
      embeddings as any,
      qdrant as any,
      prisma as any,
      gemini as any,
    );
    return { service, chunker, embeddings, qdrant, prisma, gemini };
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

  it('search embeds query, applies filters, and maps qdrant hits', async () => {
    const { service, embeddings, qdrant } = makeService();
    embeddings.embedText.mockResolvedValue([0.11, 0.22, 0.33]);
    qdrant.search.mockResolvedValue([
      {
        score: 0.91234567,
        payload: {
          articleId: 'a1',
          articleTitle: 'Auth',
          chunk: 'JWT refresh flow',
          chunkIndex: 0,
        },
      },
    ]);

    const out = await service.search({
      query: 'how refresh tokens work',
      limit: 7,
      articleStatus: 'published',
      categoryId: 'c1',
      tags: ['auth'],
    });

    expect(embeddings.embedText).toHaveBeenCalledWith('how refresh tokens work');
    expect(qdrant.search).toHaveBeenCalledWith([0.11, 0.22, 0.33], 7, {
      articleStatus: 'published',
      categoryId: 'c1',
      tags: ['auth'],
    });
    expect(out).toEqual({
      results: [
        {
          articleId: 'a1',
          articleTitle: 'Auth',
          chunk: 'JWT refresh flow',
          similarity: 0.912346,
        },
      ],
    });
  });

  it('search uses default limit=5 when omitted', async () => {
    const { service, embeddings, qdrant } = makeService();
    embeddings.embedText.mockResolvedValue([0.2, 0.3]);
    qdrant.search.mockResolvedValue([]);

    await service.search({ query: 'default limit check' });

    expect(qdrant.search).toHaveBeenCalledWith([0.2, 0.3], 5, {
      articleStatus: undefined,
      categoryId: undefined,
      tags: undefined,
    });
  });

  it('chat builds grounded answer from retrieved chunks and returns sources', async () => {
    const { service, embeddings, qdrant, gemini } = makeService();
    embeddings.embedText.mockResolvedValue([0.7, 0.8]);
    qdrant.search.mockResolvedValue([
      {
        score: 0.91,
        payload: {
          articleId: 'a1',
          articleTitle: 'Auth',
          chunk: 'Access tokens expire quickly.',
          chunkIndex: 0,
        },
      },
    ]);
    gemini.generateWithConversation.mockResolvedValue({
      text: 'Access tokens are short-lived for security.',
    });

    const out = await service.chat({
      question: 'Why are access tokens short-lived?',
      conversationId: 'c605d258-99a8-4b11-b436-8f5d3f6ef915',
    });

    expect(embeddings.embedText).toHaveBeenCalledWith(
      'Why are access tokens short-lived?',
    );
    expect(qdrant.search).toHaveBeenCalledWith([0.7, 0.8], 5);
    expect(gemini.generateWithConversation).toHaveBeenCalledWith(
      [],
      expect.stringContaining('Access tokens expire quickly.'),
      expect.stringContaining('You answer strictly using provided Knowledge Hub context.'),
    );
    expect(out).toEqual({
      answer: 'Access tokens are short-lived for security.',
      sources: [
        {
          articleId: 'a1',
          articleTitle: 'Auth',
          relevantChunk: 'Access tokens expire quickly.',
        },
      ],
      conversationId: 'c605d258-99a8-4b11-b436-8f5d3f6ef915',
    });
  });

  it('chat uses prior conversation messages and history endpoint returns trimmed memory', async () => {
    const prevLimit = process.env.RAG_CONVERSATION_MAX_MESSAGES;
    process.env.RAG_CONVERSATION_MAX_MESSAGES = '3';
    const { service, embeddings, qdrant, gemini } = makeService();
    embeddings.embedText.mockResolvedValue([0.5, 0.6]);
    qdrant.search.mockResolvedValue([]);
    gemini.generateWithConversation
      .mockResolvedValueOnce({ text: 'A1' })
      .mockResolvedValueOnce({ text: 'A2' });

    await service.chat({
      question: 'Q1',
      conversationId: 'c605d258-99a8-4b11-b436-8f5d3f6ef915',
    });
    await service.chat({
      question: 'Q2',
      conversationId: 'c605d258-99a8-4b11-b436-8f5d3f6ef915',
    });

    expect(gemini.generateWithConversation).toHaveBeenNthCalledWith(
      2,
      [
        { role: 'user', text: 'Q1' },
        { role: 'model', text: 'A1' },
      ],
      expect.any(String),
      expect.any(String),
    );

    expect(
      service.getConversationHistory('c605d258-99a8-4b11-b436-8f5d3f6ef915'),
    ).toEqual({
      conversationId: 'c605d258-99a8-4b11-b436-8f5d3f6ef915',
      messages: [
        { role: 'assistant', message: 'A1' },
        { role: 'user', message: 'Q2' },
        { role: 'assistant', message: 'A2' },
      ],
    });

    process.env.RAG_CONVERSATION_MAX_MESSAGES = prevLimit;
  });

  it('deleteArticleFromIndex throws 404 when article does not exist', async () => {
    const { service, prisma } = makeService();
    prisma.article.findUnique.mockResolvedValue(null);

    await expect(
      service.deleteArticleFromIndex('c605d258-99a8-4b11-b436-8f5d3f6ef915'),
    ).rejects.toThrow('not found');
  });

  it('deleteArticleFromIndex throws 404 when no vectors were removed', async () => {
    const { service, prisma, qdrant } = makeService();
    prisma.article.findUnique.mockResolvedValue({
      id: 'c605d258-99a8-4b11-b436-8f5d3f6ef915',
    });
    qdrant.deleteByArticleId.mockResolvedValue(0);

    await expect(
      service.deleteArticleFromIndex('c605d258-99a8-4b11-b436-8f5d3f6ef915'),
    ).rejects.toThrow('No indexed vectors');
  });
});
