import {
  HttpStatus,
  Injectable,
  InternalServerErrorException,
  ServiceUnavailableException,
} from '@nestjs/common';

export type RagVectorPayload = {
  articleId: string;
  articleTitle: string;
  chunk: string;
  chunkIndex: number;
  articleStatus?: 'draft' | 'published' | 'archived';
  categoryId?: string | null;
  tags?: string[];
};

export type RagVectorPointInput = {
  id: string;
  vector: number[];
  payload: RagVectorPayload;
};

export type RagSearchFilters = {
  articleStatus?: 'draft' | 'published' | 'archived';
  categoryId?: string;
  tags?: string[];
};

export type RagSearchMatch = {
  score: number;
  payload: RagVectorPayload;
};

type QdrantSearchResponse = {
  result?: Array<{
    score?: number;
    payload?: RagVectorPayload;
  }>;
};

@Injectable()
export class QdrantRepository {
  private readonly provider = process.env.RAG_VECTOR_DB_PROVIDER || 'qdrant';
  private readonly baseUrl =
    process.env.RAG_VECTOR_DB_URL || 'http://vectordb:6333';
  private readonly collection =
    process.env.RAG_VECTOR_COLLECTION || 'knowledge_hub_articles';
  private readonly timeoutMs = 10_000;

  private get collectionPath() {
    return `${this.baseUrl}/collections/${this.collection}`;
  }

  getCollectionName() {
    return this.collection;
  }

  async ensureCollection(vectorSize: number): Promise<void> {
    this.assertProvider();
    await this.request(`${this.collectionPath}`, {
      method: 'PUT',
      body: {
        vectors: {
          size: vectorSize,
          distance: 'Cosine',
        },
      },
    });
  }

  async upsertChunks(points: RagVectorPointInput[]): Promise<void> {
    this.assertProvider();
    if (!points.length) {
      return;
    }
    await this.request(`${this.collectionPath}/points?wait=true`, {
      method: 'PUT',
      body: { points },
    });
  }

  async search(
    vector: number[],
    limit: number,
    filters?: RagSearchFilters,
  ): Promise<RagSearchMatch[]> {
    this.assertProvider();
    const body: Record<string, unknown> = {
      vector,
      limit,
      with_payload: true,
    };
    const filter = this.buildQdrantFilter(filters);
    if (filter) {
      body.filter = filter;
    }

    const response = await this.request<QdrantSearchResponse>(
      `${this.collectionPath}/points/search`,
      {
        method: 'POST',
        body,
      },
    );

    return (response.result || [])
      .filter((r) => r.payload && typeof r.score === 'number')
      .map((r) => ({
        score: r.score as number,
        payload: r.payload as RagVectorPayload,
      }));
  }

  async deleteByArticleId(articleId: string): Promise<number> {
    this.assertProvider();
    const response = await this.request<{ result?: { operation_id?: number } }>(
      `${this.collectionPath}/points/delete?wait=true`,
      {
        method: 'POST',
        body: {
          filter: {
            must: [
              {
                key: 'articleId',
                match: { value: articleId },
              },
            ],
          },
        },
      },
    );
    return Number(response.result?.operation_id || 0);
  }

  private assertProvider() {
    if (this.provider.toLowerCase() !== 'qdrant') {
      throw new InternalServerErrorException(
        `Unsupported vector DB provider: ${this.provider}`,
      );
    }
  }

  private buildQdrantFilter(filters?: RagSearchFilters) {
    if (!filters) {
      return undefined;
    }

    const must: Array<Record<string, unknown>> = [];
    if (filters.articleStatus) {
      must.push({
        key: 'articleStatus',
        match: { value: filters.articleStatus },
      });
    }
    if (filters.categoryId) {
      must.push({
        key: 'categoryId',
        match: { value: filters.categoryId },
      });
    }
    if (filters.tags?.length) {
      must.push({
        key: 'tags',
        match: { any: filters.tags },
      });
    }

    return must.length ? { must } : undefined;
  }

  private async request<T = unknown>(
    url: string,
    options: {
      method: 'GET' | 'POST' | 'PUT' | 'DELETE';
      body?: Record<string, unknown>;
    },
  ): Promise<T> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await fetch(url, {
        method: options.method,
        headers: { 'Content-Type': 'application/json' },
        body: options.body ? JSON.stringify(options.body) : undefined,
        signal: controller.signal,
      });

      if (!response.ok) {
        if (response.status === HttpStatus.NOT_FOUND) {
          throw new ServiceUnavailableException(
            'Vector index is unavailable or missing collection.',
          );
        }
        if (response.status >= 500) {
          throw new ServiceUnavailableException(
            'Vector DB is temporarily unavailable.',
          );
        }
        throw new ServiceUnavailableException(
          `Vector DB request failed with status ${response.status}.`,
        );
      }

      return (await response.json()) as T;
    } catch (error) {
      if (error instanceof ServiceUnavailableException) {
        throw error;
      }
      if (
        error instanceof Error &&
        (error.name === 'AbortError' || error.name === 'TypeError')
      ) {
        throw new ServiceUnavailableException(
          'Vector DB timeout or network error.',
        );
      }
      throw new ServiceUnavailableException('Vector DB request failed.');
    } finally {
      clearTimeout(timeout);
    }
  }
}
