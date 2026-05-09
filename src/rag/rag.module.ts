import { Module } from '@nestjs/common';
import { RagController } from './rag.controller';
import { RagService } from './rag.service';
import { RagChunkerService } from './chunking/rag-chunker.service';
import { GeminiEmbeddingService } from './gemini-embedding.service';
import { QdrantRepository } from './vector-db/qdrant.repository';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [RagController],
  providers: [
    RagService,
    RagChunkerService,
    GeminiEmbeddingService,
    QdrantRepository,
  ],
})
export class RagModule {}
