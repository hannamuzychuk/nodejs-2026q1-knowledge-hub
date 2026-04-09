import { ApiProperty } from '@nestjs/swagger';
import { Status } from '@prisma/client';
import {
  IsArray,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';

export class CreateArticleDto {
  @ApiProperty({ example: 'How to start with Nest.js' })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty({ example: 'Content of a very interesting article...' })
  @IsString()
  @IsNotEmpty()
  content: string;

  @ApiProperty({
    enum: Status,
    default: Status.DRAFT,
    required: false,
  })
  @IsEnum(Status)
  @IsOptional()
  status?: Status = Status.DRAFT;

  @ApiProperty({ example: 'category-uuid-here', required: false })
  @IsUUID()
  @IsOptional()
  categoryId?: string | null;

  @ApiProperty({ example: ['nodejs', 'backend'], required: false })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  tags?: string[] = [];

  @ApiProperty({ example: 'user-uuid-here', required: false })
  @IsUUID()
  @IsOptional()
  authorId?: string | null;
}
