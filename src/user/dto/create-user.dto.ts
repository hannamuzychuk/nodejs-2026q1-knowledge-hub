import { ApiProperty } from '@nestjs/swagger';
import { Transform, TransformationType } from 'class-transformer';
import {
  IsNumber,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';
import { Role } from '@prisma/client';

export class CreateUserDto {
  @ApiProperty({ example: 'johndoe' })
  @IsString()
  @IsNotEmpty()
  login: string;

  @ApiProperty({ example: 'password123' })
  @IsString()
  @IsNotEmpty()
  @MinLength(6)
  password: string;

  @ApiProperty({ enum: Role, default: Role.VIEWER, required: false })
  @IsEnum(Role)
  @IsOptional()
  @Transform(({ value, type }) => {
    if (typeof value !== 'string') {
      return value;
    }
    if (type === TransformationType.PLAIN_TO_CLASS) {
      return value.toUpperCase();
    }
    if (type === TransformationType.CLASS_TO_PLAIN) {
      return value.toLowerCase();
    }
    return value;
  })
  role?: Role;

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
