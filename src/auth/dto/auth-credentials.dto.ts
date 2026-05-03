import { IsNotEmpty, IsString } from 'class-validator';

export class AuthCredentialsDto {
  @IsString()
  @IsNotEmpty()
  login: string;

  @IsString()
  @IsNotEmpty()
  password: string;
}
