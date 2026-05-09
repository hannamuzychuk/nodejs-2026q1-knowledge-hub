import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  BadRequestException,
  HttpStatus,
  InternalServerErrorException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { GeminiEmbeddingService } from './gemini-embedding.service';

describe('GeminiEmbeddingService', () => {
  const saved = {
    GEMINI_API_KEY: process.env.GEMINI_API_KEY,
    GEMINI_API_BASE_URL: process.env.GEMINI_API_BASE_URL,
    GEMINI_EMBEDDING_MODEL: process.env.GEMINI_EMBEDDING_MODEL,
  };

  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          embedding: {
            values: [0.1, 0.2, 0.3],
          },
        }),
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    for (const [k, v] of Object.entries(saved)) {
      if (v === undefined) {
        delete process.env[k];
      } else {
        process.env[k] = v;
      }
    }
  });

  it('throws when GEMINI_API_KEY is missing', async () => {
    delete process.env.GEMINI_API_KEY;
    const service = new GeminiEmbeddingService();
    await expect(service.embedText('hello')).rejects.toBeInstanceOf(
      InternalServerErrorException,
    );
  });

  it('uses GEMINI_EMBEDDING_MODEL and base URL from env', async () => {
    process.env.GEMINI_API_KEY = 'k1';
    process.env.GEMINI_EMBEDDING_MODEL = 'text-embedding-004';
    process.env.GEMINI_API_BASE_URL = 'https://example-gemini.test';

    const service = new GeminiEmbeddingService();
    await service.embedText('hello');

    const url = (globalThis.fetch as ReturnType<typeof vi.fn>).mock
      .calls[0][0] as string;
    expect(url).toMatch(
      /^https:\/\/example-gemini\.test\/v1beta\/models\/text-embedding-004:embedContent/,
    );
    expect(url).toContain('key=k1');
  });

  it('maps 429 to 503 for embedding upstream', async () => {
    process.env.GEMINI_API_KEY = 'k1';
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 429,
        json: async () => ({
          error: { status: 'RESOURCE_EXHAUSTED', message: 'quota' },
        }),
      }),
    );
    const service = new GeminiEmbeddingService();
    await expect(service.embedText('hello')).rejects.toSatisfy(
      (e: unknown) =>
        e instanceof ServiceUnavailableException &&
        e.getStatus() === HttpStatus.SERVICE_UNAVAILABLE,
    );
  });

  it('maps 400 to BadRequestException', async () => {
    process.env.GEMINI_API_KEY = 'k1';
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        json: async () => ({
          error: { message: 'invalid payload' },
        }),
      }),
    );
    const service = new GeminiEmbeddingService();
    await expect(service.embedText('hello')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('maps network TypeError to 503', async () => {
    process.env.GEMINI_API_KEY = 'k1';
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('failed')));
    const service = new GeminiEmbeddingService();
    await expect(service.embedText('hello')).rejects.toThrow(
      'AI embedding timeout or network error.',
    );
  });

  it('embeds batch by calling per text and preserving order', async () => {
    process.env.GEMINI_API_KEY = 'k1';
    const service = new GeminiEmbeddingService();
    const vectors = await service.embedTexts(['a', 'b']);
    expect(vectors).toEqual([
      [0.1, 0.2, 0.3],
      [0.1, 0.2, 0.3],
    ]);
    expect(
      (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls.length,
    ).toBe(2);
  });
});
