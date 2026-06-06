import { IsOptional, IsString, MaxLength } from 'class-validator';

export class OAuthRevokeDto {
  @IsString()
  @MaxLength(255)
  token: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  client_id?: string;
}
