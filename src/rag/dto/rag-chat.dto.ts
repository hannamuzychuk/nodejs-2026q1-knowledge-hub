import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';

export class RagChatRequestDto {
  @ApiProperty({
    example: 'Summarize key points from article about JWT security.',
  })
  @IsString()
  @IsNotEmpty()
  question: string;

  @ApiPropertyOptional({
    format: 'uuid',
    example: 'c605d258-99a8-4b11-b436-8f5d3f6ef915',
    description: 'Optional conversation id to continue existing context.',
  })
  @IsOptional()
  @IsUUID()
  conversationId?: string;
}

export class RagSourceDto {
  @ApiProperty({ format: 'uuid' })
  articleId: string;

  @ApiProperty({ example: 'Authentication in Knowledge Hub' })
  articleTitle: string;

  @ApiProperty({ example: 'JWT access token expires in 15 minutes...' })
  relevantChunk: string;
}

export class RagChatResponseDto {
  @ApiProperty()
  answer: string;

  @ApiProperty({ type: [RagSourceDto] })
  sources: RagSourceDto[];

  @ApiProperty({ format: 'uuid' })
  conversationId: string;
}

export class RagConversationHistoryItemDto {
  @ApiProperty({ example: 'user' })
  role: 'user' | 'assistant';

  @ApiProperty({ example: 'How do refresh tokens work?' })
  message: string;
}

export class RagConversationHistoryResponseDto {
  @ApiProperty({ format: 'uuid' })
  conversationId: string;

  @ApiProperty({ type: [RagConversationHistoryItemDto] })
  messages: RagConversationHistoryItemDto[];
}
