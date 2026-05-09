import { Injectable } from '@nestjs/common';

const DEFAULT_CHUNK_SIZE = 800;
const DEFAULT_CHUNK_OVERLAP = 200;

export interface RagChunk {
  index: number;
  start: number;
  end: number;
  content: string;
}

@Injectable()
export class RagChunkerService {
  private readonly chunkSize: number;
  private readonly chunkOverlap: number;

  constructor() {
    const size = this.parsePositiveInt(
      process.env.RAG_CHUNK_SIZE,
      DEFAULT_CHUNK_SIZE,
    );
    const overlap = this.parsePositiveInt(
      process.env.RAG_CHUNK_OVERLAP,
      DEFAULT_CHUNK_OVERLAP,
    );

    this.chunkSize = size;
    this.chunkOverlap = Math.min(overlap, Math.max(0, size - 1));
  }

  getConfig() {
    return {
      chunkSize: this.chunkSize,
      chunkOverlap: this.chunkOverlap,
    };
  }

  chunkText(text: string): RagChunk[] {
    if (!text) {
      return [];
    }

    const step = Math.max(1, this.chunkSize - this.chunkOverlap);
    const chunks: RagChunk[] = [];
    let index = 0;

    for (let start = 0; start < text.length; start += step) {
      const end = Math.min(start + this.chunkSize, text.length);
      chunks.push({
        index,
        start,
        end,
        content: text.slice(start, end),
      });
      index += 1;

      if (end >= text.length) {
        break;
      }
    }

    return chunks;
  }

  private parsePositiveInt(raw: string | undefined, fallback: number): number {
    const parsed = Number(raw);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      return fallback;
    }
    return Math.floor(parsed);
  }
}
