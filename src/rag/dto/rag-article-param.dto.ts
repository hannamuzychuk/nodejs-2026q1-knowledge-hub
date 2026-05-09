import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class RagArticleIdParamDto {
  @ApiProperty({
    format: 'uuid',
    example: 'b9e927b0-48f3-47ca-9975-5d000e4b3d4b',
  })
  @IsUUID()
  articleId: string;
}

export class RagConversationIdParamDto {
  @ApiProperty({
    format: 'uuid',
    example: 'c605d258-99a8-4b11-b436-8f5d3f6ef915',
  })
  @IsUUID()
  conversationId: string;
}
