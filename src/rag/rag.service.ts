import { Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Status } from '@prisma/client';
import {
  RagChatRequestDto,
  RagChatResponseDto,
  RagConversationHistoryResponseDto,
} from './dto/rag-chat.dto';
import {
  RagSearchRequestDto,
  RagSearchResponseDto,
  ReindexRequestDto,
  ReindexResponseDto,
} from './dto/rag-index.dto';
import { RagChunkerService } from './chunking/rag-chunker.service';
import { GeminiEmbeddingService } from './gemini-embedding.service';
import {
  QdrantRepository,
  RagSearchMatch,
  RagVectorPointInput,
} from './vector-db/qdrant.repository';
import { PrismaService } from '../prisma/prisma.service';
import { GeminiService } from '../ai/gemini.service';

@Injectable()
export class RagService {
  private readonly conversationMaxMessages = this.parsePositiveInt(
    process.env.RAG_CONVERSATION_MAX_MESSAGES,
    20,
  );
  private readonly conversations = new Map<
    string,
    Array<{ role: 'user' | 'assistant'; message: string }>
  >();
  private readonly indexedArticleState = new Map<string, string>();

  constructor(
    private readonly chunker: RagChunkerService,
    private readonly embeddings: GeminiEmbeddingService,
    private readonly qdrant: QdrantRepository,
    private readonly prisma: PrismaService,
    private readonly gemini: GeminiService,
  ) {}

  async reindex(body: ReindexRequestDto): Promise<ReindexResponseDto> {
    const onlyPublished = body.onlyPublished ?? true;
    const articles = await this.prisma.article.findMany({
      where: {
        id: body.articleIds?.length ? { in: body.articleIds } : undefined,
        status: onlyPublished ? Status.PUBLISHED : undefined,
      },
      include: {
        tags: { select: { name: true } },
        category: { select: { id: true } },
      },
      orderBy: [{ updatedAt: 'asc' }, { id: 'asc' }],
    });

    if (onlyPublished && !body.articleIds?.length) {
      const incomingIds = new Set(articles.map((a) => a.id));
      const staleIds = [...this.indexedArticleState.keys()].filter(
        (id) => !incomingIds.has(id),
      );
      for (const staleId of staleIds) {
        await this.qdrant.deleteByArticleId(staleId);
        this.indexedArticleState.delete(staleId);
      }
    }

    if (!articles.length) {
      return {
        indexedArticles: 0,
        indexedChunks: 0,
        vectorCollection: this.qdrant.getCollectionName(),
      };
    }

    const points: RagVectorPointInput[] = [];
    let vectorSize = 0;
    let indexedArticles = 0;
    for (const article of articles) {
      const stateToken = article.updatedAt.toISOString();
      if (this.indexedArticleState.get(article.id) === stateToken) {
        continue;
      }
      indexedArticles += 1;
      await this.qdrant.deleteByArticleId(article.id);
      const chunks = this.chunker.chunkText(article.content || '');
      if (!chunks.length) {
        this.indexedArticleState.set(article.id, stateToken);
        continue;
      }
      const vectors = await this.embeddings.embedTexts(
        chunks.map((chunk) => chunk.content),
      );
      vectorSize = vectorSize || vectors[0]?.length || 0;
      for (let i = 0; i < chunks.length; i += 1) {
        const chunk = chunks[i];
        const vector = vectors[i];
        if (!vector?.length) {
          continue;
        }
        points.push({
          id: `${article.id}:${chunk.index}`,
          vector,
          payload: {
            articleId: article.id,
            articleTitle: article.title,
            chunk: chunk.content,
            chunkIndex: chunk.index,
            articleStatus: String(article.status).toLowerCase() as
              | 'draft'
              | 'published'
              | 'archived',
            categoryId: article.category?.id || null,
            tags: article.tags.map((tag) => tag.name),
          },
        });
      }
      this.indexedArticleState.set(article.id, stateToken);
    }

    if (!vectorSize || !points.length) {
      return {
        indexedArticles,
        indexedChunks: 0,
        vectorCollection: this.qdrant.getCollectionName(),
      };
    }

    await this.qdrant.ensureCollection(vectorSize);
    await this.qdrant.upsertChunks(points);

    return {
      indexedArticles,
      indexedChunks: points.length,
      vectorCollection: this.qdrant.getCollectionName(),
    };
  }

  async search(body: RagSearchRequestDto): Promise<RagSearchResponseDto> {
    const limit = body.limit || 5;
    const queryVector = await this.embeddings.embedText(body.query);
    const semanticMatches = await this.qdrant.search(queryVector, limit * 3, {
      articleStatus: body.articleStatus,
      categoryId: body.categoryId,
      tags: body.tags,
    });
    const lexicalMatches = await this.lexicalSearch(
      body.query,
      body,
      limit * 3,
    );
    const matches = this.mergeAndRerank(
      semanticMatches,
      lexicalMatches,
      body.query,
      limit,
    );

    return {
      results: matches.map((m) => ({
        articleId: m.payload.articleId,
        articleTitle: m.payload.articleTitle,
        chunk: m.payload.chunk,
        similarity: Number(m.score.toFixed(6)),
      })),
    };
  }

  async chat(body: RagChatRequestDto): Promise<RagChatResponseDto> {
    const conversationId = body.conversationId || randomUUID();
    const history = this.conversations.get(conversationId) || [];
    const queryVector = await this.embeddings.embedText(body.question);
    const semanticMatches = await this.qdrant.search(queryVector, 15);
    const lexicalMatches = await this.lexicalSearch(body.question, {}, 15);
    const matches = this.mergeAndRerank(
      semanticMatches,
      lexicalMatches,
      body.question,
      5,
    );
    const groundedPrompt = this.buildGroundedPrompt(body.question, matches);
    const generated = await this.gemini.generateWithConversation(
      history.map((item) => ({
        role: item.role === 'assistant' ? 'model' : 'user',
        text: item.message,
      })),
      groundedPrompt,
      'You answer strictly using provided Knowledge Hub context. If evidence is insufficient, say so clearly.',
    );

    const updatedHistory = [
      ...history,
      { role: 'user' as const, message: body.question },
      { role: 'assistant' as const, message: generated.text },
    ];
    const trimmed = updatedHistory.slice(-this.conversationMaxMessages);
    this.conversations.set(conversationId, trimmed);

    return {
      answer: generated.text,
      sources: matches.map((m) => ({
        articleId: m.payload.articleId,
        articleTitle: m.payload.articleTitle,
        relevantChunk: m.payload.chunk,
      })),
      conversationId,
    };
  }

  async deleteArticleFromIndex(articleId: string): Promise<void> {
    const article = await this.prisma.article.findUnique({
      where: { id: articleId },
      select: { id: true },
    });
    if (!article) {
      throw new NotFoundException(`Article with ID ${articleId} not found`);
    }
    const operationId = await this.qdrant.deleteByArticleId(articleId);
    if (!operationId) {
      throw new NotFoundException(
        `No indexed vectors found for article ${articleId}`,
      );
    }
  }

  getConversationHistory(
    conversationId: string,
  ): RagConversationHistoryResponseDto {
    return {
      conversationId,
      messages: this.conversations.get(conversationId) || [],
    };
  }

  private buildGroundedPrompt(
    question: string,
    matches: RagSearchMatch[],
  ): string {
    const context = matches
      .map(
        (match, idx) =>
          `[${idx + 1}] articleId=${match.payload.articleId}; title="${match.payload.articleTitle}"\n${match.payload.chunk}`,
      )
      .join('\n\n---\n\n');

    return [
      'Use only the context below to answer the question.',
      'If context is insufficient, respond with: "I do not have enough indexed context to answer this question."',
      '',
      'Context:',
      context || '(no context found)',
      '',
      `Question: ${question}`,
      '',
      'Return concise answer in plain text.',
    ].join('\n');
  }

  private async lexicalSearch(
    query: string,
    filters: Pick<RagSearchRequestDto, 'articleStatus' | 'categoryId' | 'tags'>,
    limit: number,
  ): Promise<RagSearchMatch[]> {
    const terms = this.tokenize(query);
    const status = this.mapStatus(filters.articleStatus);
    const articles = await this.prisma.article.findMany({
      where: {
        status,
        categoryId: filters.categoryId,
        tags: filters.tags?.length
          ? { some: { name: { in: filters.tags } } }
          : undefined,
        OR: [
          { title: { contains: query, mode: 'insensitive' } },
          { content: { contains: query, mode: 'insensitive' } },
        ],
      },
      include: {
        tags: { select: { name: true } },
        category: { select: { id: true } },
      },
      take: Math.max(limit, 10),
      orderBy: { updatedAt: 'desc' },
    });

    const out: RagSearchMatch[] = [];
    for (const article of articles) {
      const chunks = this.chunker.chunkText(article.content || '');
      for (const chunk of chunks) {
        const score = this.termOverlapScore(chunk.content, terms);
        if (score <= 0) {
          continue;
        }
        out.push({
          score,
          payload: {
            articleId: article.id,
            articleTitle: article.title,
            chunk: chunk.content,
            chunkIndex: chunk.index,
            articleStatus: String(article.status).toLowerCase() as
              | 'draft'
              | 'published'
              | 'archived',
            categoryId: article.category?.id || null,
            tags: article.tags.map((tag) => tag.name),
          },
        });
      }
    }
    return out.sort((a, b) => b.score - a.score).slice(0, limit);
  }

  private mergeAndRerank(
    semantic: RagSearchMatch[],
    lexical: RagSearchMatch[],
    query: string,
    limit: number,
  ): RagSearchMatch[] {
    const merged = new Map<
      string,
      { match: RagSearchMatch; semantic: number; lexical: number }
    >();

    semantic.forEach((m, idx) => {
      const key = `${m.payload.articleId}:${m.payload.chunkIndex}`;
      const normalized = this.normalizeSemanticScore(m.score, idx);
      merged.set(key, { match: m, semantic: normalized, lexical: 0 });
    });
    lexical.forEach((m, idx) => {
      const key = `${m.payload.articleId}:${m.payload.chunkIndex}`;
      const normalized = this.normalizeLexicalScore(m.score, idx);
      const existing = merged.get(key);
      if (existing) {
        existing.lexical = Math.max(existing.lexical, normalized);
        return;
      }
      merged.set(key, { match: m, semantic: 0, lexical: normalized });
    });

    const terms = this.tokenize(query);
    return [...merged.values()]
      .map((row) => {
        const rerankBoost =
          this.termOverlapScore(
            `${row.match.payload.articleTitle} ${row.match.payload.chunk}`,
            terms,
          ) * 0.25;
        const finalScore = row.semantic * 0.6 + row.lexical * 0.4 + rerankBoost;
        return {
          payload: row.match.payload,
          score: finalScore,
        } as RagSearchMatch;
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  private tokenize(text: string): string[] {
    return [
      ...new Set(
        text
          .toLowerCase()
          .split(/[^a-z0-9]+/g)
          .filter(Boolean),
      ),
    ];
  }

  private termOverlapScore(content: string, terms: string[]): number {
    if (!terms.length) {
      return 0;
    }
    const hay = content.toLowerCase();
    let hits = 0;
    for (const term of terms) {
      if (hay.includes(term)) {
        hits += 1;
      }
    }
    return hits / terms.length;
  }

  private normalizeSemanticScore(score: number, idx: number): number {
    return Math.max(0, Math.min(1, score)) * (1 - Math.min(idx, 20) * 0.01);
  }

  private normalizeLexicalScore(score: number, idx: number): number {
    return Math.max(0, Math.min(1, score)) * (1 - Math.min(idx, 20) * 0.015);
  }

  private mapStatus(
    status?: 'draft' | 'published' | 'archived',
  ): Status | undefined {
    if (!status) {
      return undefined;
    }
    return String(status).toUpperCase() as Status;
  }

  private parsePositiveInt(raw: string | undefined, fallback: number): number {
    const parsed = Number(raw);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      return fallback;
    }
    return Math.floor(parsed);
  }
}
