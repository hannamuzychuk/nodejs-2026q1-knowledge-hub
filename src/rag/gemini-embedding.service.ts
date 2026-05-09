import {
  BadRequestException,
  HttpStatus,
  Injectable,
  InternalServerErrorException,
  ServiceUnavailableException,
} from '@nestjs/common';

type GeminiEmbeddingResponse = {
  embedding?: {
    values?: number[];
  };
  error?: {
    code?: number;
    message?: string;
    status?: string;
  };
};

@Injectable()
export class GeminiEmbeddingService {
  private readonly apiKey = process.env.GEMINI_API_KEY || '';
  private readonly baseUrl =
    process.env.GEMINI_API_BASE_URL ||
    'https://generativelanguage.googleapis.com';
  private readonly embeddingModel =
    process.env.GEMINI_EMBEDDING_MODEL || 'text-embedding-004';
  private readonly timeoutMs = 12_000;

  async embedText(text: string): Promise<number[]> {
    if (!this.apiKey.trim()) {
      throw new InternalServerErrorException(
        'Gemini API key is not configured on the server.',
      );
    }

    const endpoint = `${this.baseUrl}/v1beta/models/${this.embeddingModel}:embedContent?key=${this.apiKey}`;
    const response = await this.fetchWithTimeout(endpoint, {
      content: { parts: [{ text }] },
    });
    const body = (await response.json()) as GeminiEmbeddingResponse;
    this.throwIfGeminiErrorPayload(body);
    const values = body.embedding?.values;
    if (!values?.length) {
      throw new ServiceUnavailableException(
        'AI embedding provider returned empty vector.',
      );
    }
    return values;
  }

  async embedTexts(texts: string[]): Promise<number[][]> {
    const vectors: number[][] = [];
    for (const text of texts) {
      vectors.push(await this.embedText(text));
    }
    return vectors;
  }

  private async fetchWithTimeout(url: string, payload: Record<string, unknown>) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      if (!response.ok) {
        const status = response.status;
        const errPayload = await this.tryReadGeminiErrorJson(response);
        const errStatus = errPayload?.error?.status;
        const errMessage = errPayload?.error?.message;

        if (
          status === HttpStatus.UNAUTHORIZED ||
          status === HttpStatus.FORBIDDEN ||
          errStatus === 'UNAUTHENTICATED' ||
          errStatus === 'PERMISSION_DENIED'
        ) {
          throw new InternalServerErrorException(
            'AI provider authentication failed.',
          );
        }
        if (
          status === HttpStatus.TOO_MANY_REQUESTS ||
          errStatus === 'RESOURCE_EXHAUSTED' ||
          status >= 500
        ) {
          throw new ServiceUnavailableException(
            'AI embedding service is temporarily unavailable.',
          );
        }
        if (status === HttpStatus.BAD_REQUEST) {
          throw new BadRequestException(
            errMessage?.slice(0, 240) || 'Invalid embedding request.',
          );
        }
        throw new ServiceUnavailableException('AI embedding request failed.');
      }

      return response;
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof InternalServerErrorException ||
        error instanceof ServiceUnavailableException
      ) {
        throw error;
      }
      if (
        error instanceof Error &&
        (error.name === 'AbortError' || error.name === 'TypeError')
      ) {
        throw new ServiceUnavailableException(
          'AI embedding timeout or network error.',
        );
      }
      throw new ServiceUnavailableException('AI embedding request failed.');
    } finally {
      clearTimeout(timeout);
    }
  }

  private throwIfGeminiErrorPayload(body: GeminiEmbeddingResponse) {
    const err = body.error;
    if (!err) {
      return;
    }
    if (err.status === 'RESOURCE_EXHAUSTED' || err.code === 429) {
      throw new ServiceUnavailableException(
        'AI embedding service is temporarily unavailable.',
      );
    }
    if (
      err.status === 'PERMISSION_DENIED' ||
      err.status === 'UNAUTHENTICATED' ||
      err.code === 401 ||
      err.code === 403
    ) {
      throw new InternalServerErrorException(
        'AI provider authentication failed.',
      );
    }
    throw new ServiceUnavailableException('AI embedding request failed.');
  }

  private async tryReadGeminiErrorJson(response: Response) {
    try {
      return (await response.json()) as GeminiEmbeddingResponse;
    } catch {
      return undefined;
    }
  }
}
