import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional } from 'class-validator';

export const analyzeTaskOptions = [
  'review',
  'bugs',
  'optimize',
  'explain',
] as const;
export type AnalyzeTaskOption = (typeof analyzeTaskOptions)[number];

export const severityOptions = ['info', 'warning', 'error'] as const;
export type AnalysisSeverity = (typeof severityOptions)[number];

export class AnalyzeArticleRequestDto {
  @ApiPropertyOptional({
    enum: analyzeTaskOptions,
    default: 'review',
    example: 'review',
    description: 'One of: review | bugs | optimize | explain',
  })
  @IsOptional()
  @IsIn(analyzeTaskOptions)
  task?: AnalyzeTaskOption;
}

export class AnalyzeArticleResponseDto {
  articleId: string;
  analysis: string;
  suggestions: string[];
  severity: AnalysisSeverity;
}
