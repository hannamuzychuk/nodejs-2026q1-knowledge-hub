import { Module } from '@nestjs/common';
import { RagController } from './rag.controller';
import { RagService } from './rag.service';
import { RagChunkerService } from './chunking/rag-chunker.service';
import { GeminiEmbeddingService } from './gemini-embedding.service';
import { QdrantRepository } from './vector-db/qdrant.repository';
import { PrismaModule } from '../prisma/prisma.module';
import { GeminiService } from '../ai/gemini.service';

@Module({
  imports: [PrismaModule],
  controllers: [RagController],
  providers: [
    RagService,
    RagChunkerService,
    GeminiEmbeddingService,
    GeminiService,
    QdrantRepository,
  ],
})
export class RagModule {}
