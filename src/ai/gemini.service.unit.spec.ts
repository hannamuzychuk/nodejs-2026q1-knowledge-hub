import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  BadRequestException,
  HttpStatus,
  InternalServerErrorException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { GeminiService } from './gemini.service';

describe('GeminiService', () => {
  const saved = {
    GEMINI_API_KEY: process.env.GEMINI_API_KEY,
    GEMINI_MODEL: process.env.GEMINI_MODEL,
    GEMINI_API_BASE_URL: process.env.GEMINI_API_BASE_URL,
  };

  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          candidates: [{ content: { parts: [{ text: 'mocked' }] } }],
          usageMetadata: { totalTokenCount: 42 },
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

  it('throws when GEMINI_API_KEY is missing or blank', async () => {
    delete process.env.GEMINI_API_KEY;
    const svc = new GeminiService();
    await expect(svc.generate({ prompt: 'hello' })).rejects.toBeInstanceOf(
      InternalServerErrorException,
    );
  });

  it('uses GEMINI_MODEL in the REST URL (default when unset)', async () => {
    process.env.GEMINI_API_KEY = 'unit-test-key';
    delete process.env.GEMINI_MODEL;
    delete process.env.GEMINI_API_BASE_URL;

    const svc = new GeminiService();
    await svc.generate({ prompt: 'x' });

    const url = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(url).toContain('/models/gemini-2.0-flash:generateContent');
    expect(url).toContain('key=unit-test-key');
  });

  it('uses GEMINI_MODEL and GEMINI_API_BASE_URL when set', async () => {
    process.env.GEMINI_API_KEY = 'k2';
    process.env.GEMINI_MODEL = 'custom-model-x';
    process.env.GEMINI_API_BASE_URL = 'https://example-gemini.test';

    const svc = new GeminiService();
    await svc.generate({ prompt: 'y' });

    const url = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(url).toMatch(/^https:\/\/example-gemini\.test\/v1beta\/models\/custom-model-x:generateContent/);
    expect(url).toContain('key=k2');
  });

  it('maps AbortError to 503 (timeout)', async () => {
    process.env.GEMINI_API_KEY = 'k';
    const abortErr = new Error('The operation was aborted');
    abortErr.name = 'AbortError';
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(abortErr));

    const svc = new GeminiService();
    await expect(svc.generate({ prompt: 'x' })).rejects.toSatisfy(
      (e: unknown) =>
        e instanceof ServiceUnavailableException &&
        e.getStatus() === HttpStatus.SERVICE_UNAVAILABLE &&
        e.message === 'AI service timeout or network error.',
    );
  });

  it('maps TypeError (network) to 503', async () => {
    process.env.GEMINI_API_KEY = 'k';
    const netErr = new TypeError('fetch failed');
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(netErr));

    const svc = new GeminiService();
    await expect(svc.generate({ prompt: 'x' })).rejects.toThrow(
      'AI service timeout or network error.',
    );
  });

  it('maps HTTP 401 to internal auth failure message', async () => {
    process.env.GEMINI_API_KEY = 'k';
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        json: async () => ({
          error: { message: 'API key not valid', status: 'UNAUTHENTICATED' },
        }),
      }),
    );

    const svc = new GeminiService();
    await expect(svc.generate({ prompt: 'x' })).rejects.toSatisfy(
      (e: unknown) =>
        e instanceof InternalServerErrorException &&
        (e as InternalServerErrorException).message ===
          'AI provider authentication failed.',
    );
  });

  it('maps HTTP 403 with PERMISSION_DENIED payload to auth failure', async () => {
    process.env.GEMINI_API_KEY = 'k';
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 403,
        json: async () => ({
          error: { message: 'Forbidden', status: 'PERMISSION_DENIED' },
        }),
      }),
    );

    const svc = new GeminiService();
    await expect(svc.generate({ prompt: 'x' })).rejects.toThrow(
      'AI provider authentication failed.',
    );
  });

  it('retries on HTTP 429 then succeeds', async () => {
    process.env.GEMINI_API_KEY = 'k';
    const okBody = {
      candidates: [{ content: { parts: [{ text: 'after retry' }] } }],
      usageMetadata: { totalTokenCount: 1 },
    };
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce({
          ok: false,
          status: 429,
          json: async () => ({}),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => okBody,
        }),
    );

    const svc = new GeminiService();
    const out = await svc.generate({ prompt: 'x' });
    expect(out.text).toBe('after retry');
    expect((globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls.length).toBe(
      2,
    );
  });

  it('after max retries on 429 returns 503', async () => {
    process.env.GEMINI_API_KEY = 'k';
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
      json: async () => ({
        error: { status: 'RESOURCE_EXHAUSTED', message: 'Quota exceeded' },
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const svc = new GeminiService();
    await expect(svc.generate({ prompt: 'x' })).rejects.toSatisfy(
      (e: unknown) =>
        e instanceof ServiceUnavailableException &&
        String((e as Error).message).includes('rate-limited'),
    );
    expect(fetchMock.mock.calls.length).toBe(3);
  });

  it('maps HTTP 500 to 503 upstream unavailable', async () => {
    process.env.GEMINI_API_KEY = 'k';
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 502,
        json: async () => ({ error: { message: 'Bad gateway' } }),
      }),
    );

    const svc = new GeminiService();
    await expect(svc.generate({ prompt: 'x' })).rejects.toSatisfy(
      (e: unknown) =>
        e instanceof ServiceUnavailableException &&
        (e as ServiceUnavailableException).message ===
          'AI upstream is temporarily unavailable.',
    );
  });

  it('maps HTTP 400 with error message to BadRequest', async () => {
    process.env.GEMINI_API_KEY = 'k';
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        json: async () => ({
          error: { message: 'Invalid JSON payload', status: 'INVALID_ARGUMENT' },
        }),
      }),
    );

    const svc = new GeminiService();
    await expect(svc.generate({ prompt: 'x' })).rejects.toSatisfy(
      (e: unknown) =>
        e instanceof BadRequestException &&
        (e as BadRequestException).message === 'Invalid JSON payload',
    );
  });

  it('maps 200 JSON with RESOURCE_EXHAUSTED error field to rate limit + retry', async () => {
    process.env.GEMINI_API_KEY = 'k';
    const okBody = {
      candidates: [{ content: { parts: [{ text: 'ok' }] } }],
    };
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({
            error: {
              status: 'RESOURCE_EXHAUSTED',
              message: 'You exceeded your quota',
            },
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => okBody,
        }),
    );

    const svc = new GeminiService();
    const out = await svc.generate({ prompt: 'x' });
    expect(out.text).toBe('ok');
  });

  it('maps 200 JSON with UNAUTHENTICATED error to auth failure', async () => {
    process.env.GEMINI_API_KEY = 'k';
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          error: { status: 'UNAUTHENTICATED', message: 'Invalid API key' },
        }),
      }),
    );

    const svc = new GeminiService();
    await expect(svc.generate({ prompt: 'x' })).rejects.toThrow(
      'AI provider authentication failed.',
    );
  });
});
