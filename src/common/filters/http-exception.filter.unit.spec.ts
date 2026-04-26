import { ArgumentsHost, BadRequestException } from '@nestjs/common';
import { vi } from 'vitest';
import { HttpExceptionFilter } from './http-exception.filter';
import { AppLogger } from '../logging/app-logger.service';
import { NotFoundError } from '../errors/app-error';

describe('HttpExceptionFilter', () => {
  const createHost = (url = '/test') => {
    const status = vi.fn().mockReturnThis();
    const json = vi.fn();
    const response = { status, json };
    const request = { url, method: 'GET' };
    const host = {
      switchToHttp: () => ({
        getResponse: () => response,
        getRequest: () => request,
      }),
    } as unknown as ArgumentsHost;
    return { host, status, json };
  };

  it('returns expected status and error shape for HttpException', () => {
    const logger = { error: vi.fn() } as unknown as AppLogger;
    const filter = new HttpExceptionFilter(logger);
    const { host, status, json } = createHost('/users');
    const exception = new BadRequestException('Invalid payload');

    filter.catch(exception, host);

    expect(status).toHaveBeenCalledWith(400);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 400,
        error: 'Bad Request',
        message: 'Invalid payload',
      }),
    );
  });

  it('returns custom status for AppError', () => {
    const logger = { error: vi.fn() } as unknown as AppLogger;
    const filter = new HttpExceptionFilter(logger);
    const { host, status, json } = createHost('/categories');

    filter.catch(new NotFoundError('Category missing'), host);

    expect(status).toHaveBeenCalledWith(404);
    expect(json).toHaveBeenCalledWith({
      statusCode: 404,
      error: 'Not Found',
      message: 'Category missing',
    });
  });

  it('returns 500 shape for unknown errors', () => {
    const logger = { error: vi.fn() } as unknown as AppLogger;
    const filter = new HttpExceptionFilter(logger);
    const { host, status, json } = createHost('/articles');

    filter.catch(new Error('Boom'), host);

    expect(status).toHaveBeenCalledWith(500);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 500,
        error: 'Internal Server Error',
        message: 'An unexpected error occurred',
      }),
    );
  });
});
