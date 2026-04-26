import { NestFactory, Reflector } from '@nestjs/core';
import { AppModule } from './app.module';
import * as dotenv from 'dotenv';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import {
  ClassSerializerInterceptor,
  BadRequestException,
  ValidationPipe,
} from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';
import * as express from 'express';
import { assertJwtEnvConfigured } from './auth/jwt-secrets.util';
import { AppLogger } from './common/logging/app-logger.service';
import { createRequestLoggingMiddleware } from './common/logging/request-logging.middleware';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';

dotenv.config();

type RateLimitConfig = {
  windowMs: number;
  maxRequests: number;
  message: string;
};

const buildIpRateLimiter = (config: RateLimitConfig) => {
  const requestsByIp = new Map<string, number[]>();

  return (req: Request, res: Response, next: NextFunction) => {
    const now = Date.now();
    const ip =
      req.ip ||
      String(req.headers['x-forwarded-for'] || '')
        .split(',')[0]
        .trim() ||
      'unknown';

    const currentRequests = requestsByIp.get(ip) || [];
    const recentRequests = currentRequests.filter(
      (timestamp) => now - timestamp < config.windowMs,
    );

    if (recentRequests.length >= config.maxRequests) {
      return res.status(429).json({
        statusCode: 429,
        message: config.message,
        error: 'Too Many Requests',
      });
    }

    recentRequests.push(now);
    requestsByIp.set(ip, recentRequests);
    next();
  };
};

async function bootstrap() {
  assertJwtEnvConfigured();

  const logger = new AppLogger(process.env.NODE_ENV === 'production');
  const app = await NestFactory.create(AppModule, { logger: false });
  app.useLogger(logger);
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use(createRequestLoggingMiddleware(logger));
  app.useGlobalFilters(new HttpExceptionFilter(logger));

  const isProduction = process.env.NODE_ENV === 'production';

  app.use(
    '/auth/signup',
    buildIpRateLimiter({
      windowMs: 60_000,
      maxRequests: isProduction ? 3 : 60,
      message: 'Too many signup attempts. Try again in a minute.',
    }),
  );

  app.use(
    '/auth/login',
    buildIpRateLimiter({
      windowMs: 60_000,
      maxRequests: isProduction ? 5 : 120,
      message: 'Too many login attempts. Try again in a minute.',
    }),
  );

  app.useGlobalInterceptors(new ClassSerializerInterceptor(app.get(Reflector)));

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: false,
      transformOptions: {
        enableImplicitConversion: false,
      },
      errorHttpStatusCode: 400,
      exceptionFactory: (errors) => {
        const messages = errors.flatMap((err) => {
          const constraints = err.constraints
            ? Object.values(err.constraints)
            : [];
          const childErrors = err.children
            ? err.children.flatMap((c) => Object.values(c.constraints || {}))
            : [];
          return [...constraints, ...childErrors];
        });
        return new BadRequestException(messages);
      },
    }),
  );

  const config = new DocumentBuilder()
    .setTitle('Knowledge Hub API')
    .setDescription('The Knowledge Hub API description')
    .setVersion('1.0')
    .addBearerAuth()
    .addTag('auth')
    .addTag('users')
    .addTag('articles')
    .addTag('categories')
    .addTag('comments')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('doc', app, document);

  const port = process.env.PORT || 4000;
  let isShuttingDown = false;

  const gracefulShutdown = async (
    signal: string,
    error?: unknown,
    level: 'fatal' | 'error' = 'fatal',
  ) => {
    if (isShuttingDown) {
      return;
    }
    isShuttingDown = true;

    const stack = error instanceof Error ? error.stack : undefined;
    if (level === 'fatal') {
      logger.fatal(
        `${signal} received. Starting graceful shutdown.`,
        stack,
        error instanceof Error ? { message: error.message } : error,
      );
    } else {
      logger.error(
        `${signal} received. Starting graceful shutdown.`,
        stack,
        'process',
        error instanceof Error ? { message: error.message } : error,
      );
    }

    try {
      await app.close();
    } catch (closeError) {
      logger.error(
        'Error while closing Nest application',
        closeError instanceof Error ? closeError.stack : undefined,
        'Bootstrap',
      );
    } finally {
      process.exit(1);
    }
  };

  process.on('uncaughtException', (error) => {
    void gracefulShutdown('uncaughtException', error);
  });
  process.on('unhandledRejection', (reason) => {
    void gracefulShutdown('unhandledRejection', reason, 'error');
  });

  await app.listen(port);
  logger.log(`Server is running on: http://localhost:${port}`, 'Bootstrap');
  logger.log(`Swagger docs on: http://localhost:${port}/doc`, 'Bootstrap');
}
bootstrap();
