import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import * as dotenv from 'dotenv';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { BadRequestException, ValidationPipe } from '@nestjs/common';

dotenv.config();

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    transform: true,
    errorHttpStatusCode: 400,
    exceptionFactory: (errors) => {
    const messages = errors.flatMap((err) => {
    const constraints = err.constraints ? Object.values(err.constraints) : [];
    const childErrors = err.children ? err.children.flatMap(c => Object.values(c.constraints || {})) : [];
    return [...constraints, ...childErrors];
    });
    return new BadRequestException(messages);
  },
  }));

  const config = new DocumentBuilder()
  .setTitle('Knowledge Hub API')
  .setDescription('The Knowledge Hub API description')
  .setVersion('1.0')
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
