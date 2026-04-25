import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { AppError } from '../errors/app-error';
import { AppLogger } from '../logging/app-logger.service';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  constructor(private readonly logger: AppLogger) {}

  catch(exception: unknown, host: ArgumentsHost) {
    const context = host.switchToHttp();
    const response = context.getResponse();
    const request = context.getRequest();

    const { statusCode, message, error } = this.resolveErrorPayload(exception);
    const stackTrace = exception instanceof Error ? exception.stack : undefined;

    this.logger.error(
      {
        message,
        method: request.method,
        path: request.url,
        statusCode,
      },
      stackTrace,
      'HttpExceptionFilter',
    );

    response.status(statusCode).json({
      statusCode,
      error,
      message,
    });
  }

  private resolveErrorPayload(exception: unknown) {
    if (exception instanceof AppError) {
      return {
        statusCode: exception.statusCode,
        error: this.errorNameFromStatus(exception.statusCode),
        message: exception.message,
      };
    }

    if (exception instanceof HttpException) {
      const statusCode = exception.getStatus();
      const payload = exception.getResponse();
      const message =
        typeof payload === 'string'
          ? payload
          : (payload as { message?: string | string[] }).message ||
            this.errorNameFromStatus(statusCode);

      return {
        statusCode,
        error: this.errorNameFromStatus(statusCode),
        message,
      };
    }

    return {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      error: 'Internal Server Error',
      message: 'An unexpected error occurred',
    };
  }

  private errorNameFromStatus(statusCode: number) {
    const label = HttpStatus[statusCode] as string | undefined;
    if (typeof label !== 'string') {
      return 'Error';
    }
    return label
      .toLowerCase()
      .split('_')
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');
  }
}
