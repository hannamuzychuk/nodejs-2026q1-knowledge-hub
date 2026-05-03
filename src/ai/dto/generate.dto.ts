import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class GenerateRequestDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  prompt: string;

  @ApiPropertyOptional({ example: 'You are a helpful assistant.' })
  @IsString()
  @IsOptional()
  systemInstruction?: string;
}

export class GenerateResponseDto {
  output: string;
}
