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
import { assertJwtEnvConfigured } from './auth/jwt-secrets.util';

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

  const app = await NestFactory.create(AppModule);

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
  await app.listen(port);
  console.log(`🚀 Server is running on: http://localhost:${port}`);
  console.log(`Application is running on: http://localhost:${port}/doc`);
}
bootstrap();
