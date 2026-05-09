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

@Injectable()
export class RagService {
  reindex(_body: ReindexRequestDto): ReindexResponseDto {
    return {
      indexedArticles: 0,
      indexedChunks: 0,
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
