import { Injectable } from '@nestjs/common';
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

    if (!articles.length) {
      return {
        indexedArticles: 0,
        indexedChunks: 0,
        vectorCollection: this.qdrant.getCollectionName(),
      };
    }

    const points: RagVectorPointInput[] = [];
    let vectorSize = 0;
    for (const article of articles) {
      await this.qdrant.deleteByArticleId(article.id);
      const chunks = this.chunker.chunkText(article.content || '');
      if (!chunks.length) {
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
    }

    if (!vectorSize || !points.length) {
      return {
        indexedArticles: articles.length,
        indexedChunks: 0,
        vectorCollection: this.qdrant.getCollectionName(),
      };
    }

    await this.qdrant.ensureCollection(vectorSize);
    await this.qdrant.upsertChunks(points);

    return {
      indexedArticles: articles.length,
      indexedChunks: points.length,
      vectorCollection: this.qdrant.getCollectionName(),
    };
  }

  async search(body: RagSearchRequestDto): Promise<RagSearchResponseDto> {
    const limit = body.limit || 5;
    const queryVector = await this.embeddings.embedText(body.query);
    const matches = await this.qdrant.search(queryVector, limit, {
      articleStatus: body.articleStatus,
      categoryId: body.categoryId,
      tags: body.tags,
    });

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
    const matches = await this.qdrant.search(queryVector, 5);
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

  deleteArticleFromIndex(_articleId: string): void {
    return;
  }

  getConversationHistory(
    conversationId: string,
  ): RagConversationHistoryResponseDto {
    return {
      conversationId,
      messages: this.conversations.get(conversationId) || [],
    };
  }

  private buildGroundedPrompt(question: string, matches: RagSearchMatch[]): string {
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

  private parsePositiveInt(raw: string | undefined, fallback: number): number {
    const parsed = Number(raw);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      return fallback;
    }
    return Math.floor(parsed);
  }
}
