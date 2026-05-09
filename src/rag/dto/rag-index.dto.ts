import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';

export class ReindexRequestDto {
  @ApiPropertyOptional({
    default: true,
    description:
      'When true, indexes only published articles. Defaults to true when omitted.',
  })
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  onlyPublished?: boolean;

  @ApiPropertyOptional({
    type: [String],
    description: 'Optional list of specific article UUIDs to index.',
    example: ['b9e927b0-48f3-47ca-9975-5d000e4b3d4b'],
  })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  articleIds?: string[];
}

export class ReindexResponseDto {
  @ApiProperty({ example: 12 })
  @IsInt()
  indexedArticles: number;

  @ApiProperty({ example: 87 })
  @IsInt()
  indexedChunks: number;

  @ApiProperty({ example: 'knowledge_hub_articles' })
  @IsString()
  vectorCollection: string;
}

export class RagSearchRequestDto {
  @ApiProperty({
    example: 'How do JWT refresh tokens work in this project?',
  })
  @IsString()
  query: string;

  @ApiPropertyOptional({
    default: 5,
    minimum: 1,
    maximum: 20,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(20)
  limit?: number;

  @ApiPropertyOptional({
    enum: ['draft', 'published', 'archived'],
    description: 'Optional article status filter.',
  })
  @IsOptional()
  @IsString()
  articleStatus?: 'draft' | 'published' | 'archived';

  @ApiPropertyOptional({
    format: 'uuid',
    example: '3fda4b5d-834d-4444-9bc0-2f2d909abc98',
  })
  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @ApiPropertyOptional({
    type: [String],
    description: 'Optional tag filter.',
    example: ['nestjs', 'testing'],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];
}

export class RagSearchResultDto {
  @ApiProperty({ format: 'uuid' })
  articleId: string;

  @ApiProperty({ example: 'Authentication in Knowledge Hub' })
  articleTitle: string;

  @ApiProperty({ example: 'Refresh tokens are rotated every login...' })
  chunk: string;

  @ApiProperty({ example: 0.8893 })
  similarity: number;
}

export class RagSearchResponseDto {
  @ApiProperty({ type: [RagSearchResultDto] })
  results: RagSearchResultDto[];
}
