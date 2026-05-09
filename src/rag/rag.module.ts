import { Module } from '@nestjs/common';
import { RagController } from './rag.controller';
import { RagService } from './rag.service';
import { RagChunkerService } from './chunking/rag-chunker.service';

@Module({
  controllers: [RagController],
  providers: [RagService, RagChunkerService],
})
export class RagModule {}
