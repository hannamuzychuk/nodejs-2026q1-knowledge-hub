import { ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { CreateUserDto } from './create-user.dto';
import { IsString } from 'class-validator';

export class UpdateUserDto extends PartialType(CreateUserDto) {
  @ApiPropertyOptional({ example: 'oldSecret123' })
  @IsString()
  oldPassword: string;

  @ApiPropertyOptional({ example: 'newSecret456' })
  @IsString()
  newPassword: string;
}
