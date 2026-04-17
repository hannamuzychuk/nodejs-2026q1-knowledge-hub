import { Allow } from 'class-validator';

export class RefreshTokenDto {
  @Allow()
  refreshToken?: string;
}
