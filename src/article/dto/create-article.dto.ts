import { ApiProperty } from "@nestjs/swagger";
import { IsArray, IsEnum, IsNotEmpty, IsOptional, IsString, IsUUID } from "class-validator";
import { ArticleStatus } from '../entities/article.entity';

export class CreateArticleDto {
    @ApiProperty({ example: 'Jak zacząć z Nest.js' })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty({ example: 'Treść bardzo ciekawego artykułu...' })
  @IsString()
  @IsNotEmpty()
  content: string;

  @ApiProperty({ enum: ArticleStatus, default: ArticleStatus.DRAFT, required: false })
  @IsEnum(ArticleStatus)
  @IsOptional()
  status?: ArticleStatus = ArticleStatus.DRAFT;

  @ApiProperty({ example: 'uuid-kategorii', required: false })
  @IsUUID()
  @IsOptional()
  categoryId?: string | null;

  @ApiProperty({ example: ['nodejs', 'backend'], required: false })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  tags?: string[] = [];

  // authorId zazwyczaj bierzemy z tokena, ale jeśli zadanie wymaga go w body:
  @ApiProperty({ example: 'uuid-uzytkownika', required: false })
  @IsUUID()
  @IsOptional()
  authorId?: string | null;
}
