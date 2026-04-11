import { Transform, TransformationType } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { Status } from '@prisma/client';
import {
  IsArray,
  IsEnum,
  IsNumber,
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
  @Transform(({ value, type }) => {
    if (type === TransformationType.PLAIN_TO_CLASS) {
      return typeof value === 'string' ? value.toUpperCase() : value;
    }
    if (type === TransformationType.CLASS_TO_PLAIN) {
      return typeof value === 'string' ? value.toLowerCase() : value;
    }
    return value;
  })
  status?: Status = Status.DRAFT;

  @ApiProperty({ example: 'category-uuid-here', required: false })
  @IsUUID()
  @IsOptional()
  categoryId?: string | null;

  @ApiProperty({ example: ['nodejs', 'backend'], required: false })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  @Transform(
    ({ value }) =>
      Array.isArray(value)
        ? value.map((tag) => (typeof tag === 'object' ? tag.name : tag))
        : value,
    { toPlainOnly: true },
  )
  tags?: string[] = [];

  @ApiProperty({ example: 'user-uuid-here', required: false })
  @IsUUID()
  @IsOptional()
  authorId?: string | null;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  @Transform(({ value }) => (value instanceof Date ? value.getTime() : value), {
    toPlainOnly: true,
  })
  createdAt?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  @Transform(({ value }) => (value instanceof Date ? value.getTime() : value), {
    toPlainOnly: true,
  })
  updatedAt?: number;
}
