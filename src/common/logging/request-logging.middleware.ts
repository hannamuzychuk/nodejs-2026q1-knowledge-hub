import { NextFunction, Request, Response } from 'express';
import { AppLogger } from './app-logger.service';
import { redactSensitiveData } from './sanitize-log-data.util';

export const createRequestLoggingMiddleware =
  (logger: AppLogger) => (req: Request, res: Response, next: NextFunction) => {
    const startedAt = process.hrtime.bigint();

    logger.log(
      {
        method: req.method,
        url: req.originalUrl || req.url,
        query: redactSensitiveData(req.query),
        body: redactSensitiveData(req.body),
      },
      'Request',
    );

    res.on('finish', () => {
      const durationMs =
        Number(process.hrtime.bigint() - startedAt) / 1_000_000;
      logger.log(
        {
          method: req.method,
          url: req.originalUrl || req.url,
          statusCode: res.statusCode,
          responseTimeMs: Number(durationMs.toFixed(2)),
        },
        'Response',
      );
    });

    next();
  };
