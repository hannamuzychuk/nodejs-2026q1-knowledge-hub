import { Module } from '@nestjs/common';
import { RagController } from './rag.controller';
import { RagService } from './rag.service';
import { RagChunkerService } from './chunking/rag-chunker.service';
import { GeminiEmbeddingService } from './gemini-embedding.service';

@Module({
  controllers: [RagController],
  providers: [RagService, RagChunkerService, GeminiEmbeddingService],
})
export class RagModule {}
