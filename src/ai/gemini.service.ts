import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  InternalServerErrorException,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';

type GeminiGenerateResult = {
  text: string;
  tokenUsage?: number;
};

type GeminiApiResponse = {
  candidates?: Array<{
    content?: {
      parts?: Array<{ text?: string }>;
    };
  }>;
  usageMetadata?: {
    totalTokenCount?: number;
  };
  error?: {
    code?: number;
    message?: string;
    status?: string;
  };
};

export type GeminiContentPart = {
  role: 'user' | 'model';
  text: string;
};

@Injectable()
export class GeminiService {
  private readonly logger = new Logger(GeminiService.name);
  private readonly apiKey = process.env.GEMINI_API_KEY || '';
  private readonly baseUrl =
    process.env.GEMINI_API_BASE_URL ||
    'https://generativelanguage.googleapis.com';
  private readonly model = process.env.GEMINI_MODEL || 'gemini-2.0-flash';
  private readonly timeoutMs = 12_000;
  private readonly maxRetries = 3;

  async generate(options: {
    prompt: string;
    systemInstruction?: string;
  }): Promise<GeminiGenerateResult> {
    return this.generateFromContents(
      [{ role: 'user', text: options.prompt }],
      options.systemInstruction,
    );
  }

  /**
   * Multi-turn chat: prior turns plus the new user message (caller appends the new prompt as last user turn in `priorAndUser` or we pass separately).
   * Here: `priorTurns` are completed exchanges; `userMessage` is the new prompt.
   */
  async generateWithConversation(
    priorTurns: GeminiContentPart[],
    userMessage: string,
    systemInstruction?: string,
  ): Promise<GeminiGenerateResult> {
    const contents: GeminiContentPart[] = [
      ...priorTurns,
      { role: 'user', text: userMessage },
    ];
    return this.generateFromContents(contents, systemInstruction);
  }

  private async generateFromContents(
    contents: GeminiContentPart[],
    systemInstruction?: string | undefined,
  ): Promise<GeminiGenerateResult> {
    if (!this.apiKey.trim()) {
      throw new InternalServerErrorException(
        'Gemini API key is not configured on the server.',
      );
    }

    const endpoint = `${this.baseUrl}/v1beta/models/${this.model}:generateContent?key=${this.apiKey}`;
    const payload: Record<string, unknown> = {
      contents: contents.map((c) => ({
        role: c.role,
        parts: [{ text: c.text }],
      })),
    };
    if (systemInstruction) {
      payload.systemInstruction = {
        parts: [{ text: systemInstruction }],
      };
    }

    let attempt = 0;
    while (attempt < this.maxRetries) {
      attempt += 1;
      try {
        const response = await this.fetchWithTimeout(endpoint, payload);
        const body = (await response.json()) as GeminiApiResponse;
        this.throwIfGeminiErrorPayload(body);
        const text = this.extractText(body);
        return {
          text,
          tokenUsage: body.usageMetadata?.totalTokenCount,
        };
      } catch (error) {
        if (error instanceof HttpException) {
          if (error.getStatus() === HttpStatus.TOO_MANY_REQUESTS) {
            if (attempt >= this.maxRetries) {
              throw new ServiceUnavailableException(
                'AI upstream is rate-limited. Please try again later.',
              );
            }
            await this.sleep(200 * 2 ** (attempt - 1));
            continue;
          }
          throw error;
        }
        throw new ServiceUnavailableException(
          'AI service is temporarily unavailable.',
        );
      }
    }

    throw new ServiceUnavailableException(
      'AI service is temporarily unavailable.',
    );
  }

  private async fetchWithTimeout(
    url: string,
    payload: Record<string, unknown>,
  ) {
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
          this.logger.error(
            `Gemini authentication failed (HTTP ${status})${errMessage ? `: ${errMessage}` : ''}`,
          );
          throw new InternalServerErrorException(
            'AI provider authentication failed.',
          );
        }
        if (
          status === HttpStatus.TOO_MANY_REQUESTS ||
          errStatus === 'RESOURCE_EXHAUSTED'
        ) {
          if (errMessage) {
            this.logger.warn(`Gemini rate limit: ${errMessage}`);
          }
          throw new HttpException(
            'Gemini rate limited',
            HttpStatus.TOO_MANY_REQUESTS,
          );
        }
        if (status >= 500) {
          if (errMessage) {
            this.logger.warn(`Gemini upstream ${status}: ${errMessage}`);
          }
          throw new ServiceUnavailableException(
            'AI upstream is temporarily unavailable.',
          );
        }
        if (status === HttpStatus.BAD_REQUEST) {
          throw new BadRequestException(
            errMessage?.slice(0, 240) ||
              'AI could not process the request (invalid input).',
          );
        }
        if (errMessage) {
          this.logger.warn(`Gemini request failed (HTTP ${status}): ${errMessage}`);
        }
        throw new InternalServerErrorException('AI request failed.');
      }

      return response;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      if (
        error instanceof Error &&
        (error.name === 'AbortError' || error.name === 'TypeError')
      ) {
        throw new ServiceUnavailableException(
          'AI service timeout or network error.',
        );
      }
      throw new ServiceUnavailableException('AI service request failed.');
    } finally {
      clearTimeout(timeout);
    }
  }

  private throwIfGeminiErrorPayload(body: GeminiApiResponse) {
    const err = body.error;
    if (!err) {
      return;
    }
    const st = err.status;
    const code = err.code;
    if (st === 'RESOURCE_EXHAUSTED' || code === 429) {
      this.logger.warn(`Gemini rate limit (payload): ${err.message || st}`);
      throw new HttpException(
        'Gemini rate limited',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    if (
      st === 'PERMISSION_DENIED' ||
      st === 'UNAUTHENTICATED' ||
      code === 401 ||
      code === 403
    ) {
      this.logger.error(
        `Gemini authentication failed (${st || code}): ${err.message || ''}`,
      );
      throw new InternalServerErrorException(
        'AI provider authentication failed.',
      );
    }
    this.logger.warn(`Gemini error payload: ${err.message || st || 'unknown'}`);
    throw new ServiceUnavailableException(
      'AI provider rejected the request.',
    );
  }

  private async tryReadGeminiErrorJson(response: Response) {
    try {
      return (await response.json()) as GeminiApiResponse;
    } catch {
      return undefined;
    }
  }

  private extractText(payload: GeminiApiResponse) {
    const text = payload.candidates?.[0]?.content?.parts
      ?.map((part) => part.text || '')
      .join('')
      .trim();

    if (!text) {
      throw new ServiceUnavailableException(
        'AI provider returned an empty response.',
      );
    }
    return text;
  }

  private sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
