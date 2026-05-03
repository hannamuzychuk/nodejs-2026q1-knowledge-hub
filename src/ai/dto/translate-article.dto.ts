import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class TranslateArticleRequestDto {
  @ApiProperty({ example: 'Polish' })
  @IsString()
  @IsNotEmpty()
  targetLanguage: string;

  @ApiPropertyOptional({ example: 'English' })
  @IsString()
  @IsOptional()
  sourceLanguage?: string;
}

export class TranslateArticleResponseDto {
  articleId: string;
  translatedText: string;
  detectedLanguage: string;
}
