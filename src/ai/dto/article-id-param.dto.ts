import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export const swaggerExampleArticleId = 'f47ac10b-58cc-4372-a567-0e02b2c3d479';

export class ArticleIdParamDto {
  @ApiProperty({
    format: 'uuid',
    example: swaggerExampleArticleId,
    description:
      'Existing article UUID. Run GET /article with auth and copy a real `id` (the example is only valid format).',
  })
  @IsUUID()
  articleId: string;
}
