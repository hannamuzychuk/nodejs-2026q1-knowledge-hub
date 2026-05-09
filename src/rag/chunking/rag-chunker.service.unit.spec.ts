import { describe, expect, it } from 'vitest';
import { RagChunkerService } from './rag-chunker.service';

describe('RagChunkerService', () => {
  it('uses defaults when env values are missing or invalid', () => {
    const prevSize = process.env.RAG_CHUNK_SIZE;
    const prevOverlap = process.env.RAG_CHUNK_OVERLAP;
    delete process.env.RAG_CHUNK_SIZE;
    process.env.RAG_CHUNK_OVERLAP = 'invalid';

    const chunker = new RagChunkerService();
    expect(chunker.getConfig()).toEqual({
      chunkSize: 800,
      chunkOverlap: 200,
    });

    process.env.RAG_CHUNK_SIZE = prevSize;
    process.env.RAG_CHUNK_OVERLAP = prevOverlap;
  });

  it('reads chunk config from env and clamps overlap below chunk size', () => {
    const prevSize = process.env.RAG_CHUNK_SIZE;
    const prevOverlap = process.env.RAG_CHUNK_OVERLAP;
    process.env.RAG_CHUNK_SIZE = '10';
    process.env.RAG_CHUNK_OVERLAP = '99';

    const chunker = new RagChunkerService();
    expect(chunker.getConfig()).toEqual({
      chunkSize: 10,
      chunkOverlap: 9,
    });

    process.env.RAG_CHUNK_SIZE = prevSize;
    process.env.RAG_CHUNK_OVERLAP = prevOverlap;
  });

  it('splits text deterministically with configured overlap', () => {
    const prevSize = process.env.RAG_CHUNK_SIZE;
    const prevOverlap = process.env.RAG_CHUNK_OVERLAP;
    process.env.RAG_CHUNK_SIZE = '5';
    process.env.RAG_CHUNK_OVERLAP = '2';

    const chunker = new RagChunkerService();
    const text = 'abcdefghij';
    const chunks = chunker.chunkText(text);

    expect(chunks).toEqual([
      { index: 0, start: 0, end: 5, content: 'abcde' },
      { index: 1, start: 3, end: 8, content: 'defgh' },
      { index: 2, start: 6, end: 10, content: 'ghij' },
    ]);

    expect(chunker.chunkText(text)).toEqual(chunks);

    process.env.RAG_CHUNK_SIZE = prevSize;
    process.env.RAG_CHUNK_OVERLAP = prevOverlap;
  });

  it('returns empty array for empty text', () => {
    const chunker = new RagChunkerService();
    expect(chunker.chunkText('')).toEqual([]);
  });
});
