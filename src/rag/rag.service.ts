import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
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

@Injectable()
export class RagService {
  constructor(private readonly chunker: RagChunkerService) {}

  reindex(_body: ReindexRequestDto): ReindexResponseDto {
    const initialChunksCount = this.chunker.chunkText('').length;
    return {
      indexedArticles: 0,
      indexedChunks: initialChunksCount,
      vectorCollection:
        process.env.RAG_VECTOR_COLLECTION || 'knowledge_hub_articles',
    };
  }

  search(_body: RagSearchRequestDto): RagSearchResponseDto {
    return { results: [] };
  }

  chat(body: RagChatRequestDto): RagChatResponseDto {
    return {
      answer: `RAG scaffold is ready. Received question: ${body.question}`,
      sources: [],
      conversationId: body.conversationId || randomUUID(),
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
      messages: [],
    };
  }
}
