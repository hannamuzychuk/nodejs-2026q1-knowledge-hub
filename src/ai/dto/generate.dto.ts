import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';

export class GenerateRequestDto {
  @ApiProperty({
    example: 'Say hello in exactly one short sentence.',
    description: 'User message sent to Gemini.',
  })
  @IsString()
  @IsNotEmpty()
  prompt: string;

  @ApiPropertyOptional({ example: 'You are a helpful assistant.' })
  @IsString()
  @IsOptional()
  systemInstruction?: string;

  @ApiPropertyOptional({
    description:
      'Optional session id from a prior /ai/generate response; enables short-term multi-turn memory.',
    format: 'uuid',
    example: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  })
  @IsOptional()
  @IsUUID()
  sessionId?: string;
}

export class GenerateResponseDto {
  output: string;

  @ApiProperty({ format: 'uuid' })
  sessionId: string;
}
