import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional } from 'class-validator';

export const summaryLengthOptions = ['short', 'medium', 'detailed'] as const;
export type SummaryLengthOption = (typeof summaryLengthOptions)[number];

export class SummarizeArticleRequestDto {
  @ApiPropertyOptional({
    enum: summaryLengthOptions,
    default: 'medium',
  })
  @IsOptional()
  @IsIn(summaryLengthOptions)
  maxLength?: SummaryLengthOption;
}

export class SummarizeArticleResponseDto {
  articleId: string;
  summary: string;
  originalLength: number;
  summaryLength: number;
}
