import { ArgumentsHost, BadRequestException } from '@nestjs/common';
import { vi } from 'vitest';
import { HttpExceptionFilter } from './http-exception.filter';

describe('HttpExceptionFilter', () => {
  const createHost = (url = '/test') => {
    const status = vi.fn().mockReturnThis();
    const json = vi.fn();
    const response = { status, json };
    const request = { url };
    const host = {
      switchToHttp: () => ({
        getResponse: () => response,
        getRequest: () => request,
      }),
    } as unknown as ArgumentsHost;
    return { host, status, json };
  };

  it('returns expected status and error shape for HttpException', () => {
    const filter = new HttpExceptionFilter();
    const { host, status, json } = createHost('/users');
    const exception = new BadRequestException('Invalid payload');

    filter.catch(exception, host);

    expect(status).toHaveBeenCalledWith(400);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 400,
        message: 'Invalid payload',
        path: '/users',
        timestamp: expect.any(String),
      }),
    );
  });

  it('returns 500 shape for non-HttpException errors', () => {
    const filter = new HttpExceptionFilter();
    const { host, status, json } = createHost('/articles');

    filter.catch(new Error('Boom'), host);

    expect(status).toHaveBeenCalledWith(500);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 500,
        message: 'Internal server error',
        path: '/articles',
        timestamp: expect.any(String),
      }),
    );
  });
});
