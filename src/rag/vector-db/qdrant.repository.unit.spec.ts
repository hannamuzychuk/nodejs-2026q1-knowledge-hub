import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  InternalServerErrorException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { QdrantRepository } from './qdrant.repository';

describe('QdrantRepository', () => {
  const saved = {
    RAG_VECTOR_DB_PROVIDER: process.env.RAG_VECTOR_DB_PROVIDER,
    RAG_VECTOR_DB_URL: process.env.RAG_VECTOR_DB_URL,
    RAG_VECTOR_COLLECTION: process.env.RAG_VECTOR_COLLECTION,
  };

  beforeEach(() => {
    process.env.RAG_VECTOR_DB_PROVIDER = 'qdrant';
    process.env.RAG_VECTOR_DB_URL = 'http://vectordb.test:6333';
    process.env.RAG_VECTOR_COLLECTION = 'kh_test_vectors';
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ result: [] }),
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    for (const [k, v] of Object.entries(saved)) {
      if (v === undefined) {
        delete process.env[k];
      } else {
        process.env[k] = v;
      }
    }
  });

  it('ensures collection with cosine distance', async () => {
    const repo = new QdrantRepository();
    await repo.ensureCollection(768);
    const [url, request] = (
      globalThis.fetch as ReturnType<typeof vi.fn>
    ).mock.calls[0] as [string, RequestInit];
    expect(url).toBe('http://vectordb.test:6333/collections/kh_test_vectors');
    expect(request.method).toBe('PUT');
    expect(String(request.body)).toContain('"distance":"Cosine"');
    expect(String(request.body)).toContain('"size":768');
  });

  it('upserts points payload', async () => {
    const repo = new QdrantRepository();
    await repo.upsertChunks([
      {
        id: 'p1',
        vector: [0.1, 0.2],
        payload: {
          articleId: 'a1',
          articleTitle: 't',
          chunk: 'c',
          chunkIndex: 0,
        },
      },
    ]);

    const [url, request] = (
      globalThis.fetch as ReturnType<typeof vi.fn>
    ).mock.calls[0] as [string, RequestInit];
    expect(url).toBe(
      'http://vectordb.test:6333/collections/kh_test_vectors/points?wait=true',
    );
    expect(request.method).toBe('PUT');
  });

  it('search adds filters and maps results', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          result: [
            {
              score: 0.91,
              payload: {
                articleId: 'a1',
                articleTitle: 'Auth',
                chunk: 'jwt',
                chunkIndex: 2,
              },
            },
          ],
        }),
      }),
    );
    const repo = new QdrantRepository();
    const out = await repo.search([0.3, 0.4], 5, {
      articleStatus: 'published',
      categoryId: 'c1',
      tags: ['auth'],
    });
    expect(out).toEqual([
      {
        score: 0.91,
        payload: {
          articleId: 'a1',
          articleTitle: 'Auth',
          chunk: 'jwt',
          chunkIndex: 2,
        },
      },
    ]);
    const [, request] = (
      globalThis.fetch as ReturnType<typeof vi.fn>
    ).mock.calls[0] as [string, RequestInit];
    expect(String(request.body)).toContain('"articleStatus"');
    expect(String(request.body)).toContain('"categoryId"');
    expect(String(request.body)).toContain('"tags"');
  });

  it('deletes points by article id', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          result: { operation_id: 17 },
        }),
      }),
    );
    const repo = new QdrantRepository();
    const opId = await repo.deleteByArticleId('a1');
    expect(opId).toBe(17);
  });

  it('throws for unsupported provider', async () => {
    process.env.RAG_VECTOR_DB_PROVIDER = 'chroma';
    const repo = new QdrantRepository();
    await expect(repo.ensureCollection(768)).rejects.toBeInstanceOf(
      InternalServerErrorException,
    );
  });

  it('maps network failure to ServiceUnavailableException', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('offline')));
    const repo = new QdrantRepository();
    await expect(repo.ensureCollection(768)).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });
});
