import { ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { CreateUserDto } from './create-user.dto';
import { IsOptional, IsString } from 'class-validator';

export class UpdateUserDto extends PartialType(CreateUserDto) {
  @ApiPropertyOptional({ example: 'oldSecret123' })
  @IsOptional()
  @IsString()
  oldPassword?: string;

  @ApiPropertyOptional({ example: 'newSecret456' })
  @IsOptional()
  @IsString()
  newPassword?: string;
}
