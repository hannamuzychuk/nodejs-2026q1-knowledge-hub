import { ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { CreateUserDto } from './create-user.dto';
import { IsOptional, IsString } from 'class-validator';

export class UpdateUserDto extends PartialType(CreateUserDto) {
    @ApiPropertyOptional({ example: 'oldSecret123' })
  @IsString()
  @IsOptional()
  oldPassword?: string;

  @ApiPropertyOptional({ example: 'newSecret456' })
  @IsString()
  @IsOptional()
  newPassword?: string;

  // @ApiPropertyOptional({ example: 'new_login' })
  // @IsString()
  // @IsOptional()
  // login?: string;
}
