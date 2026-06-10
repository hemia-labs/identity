import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export class OAuthRevokeDto {
  @IsString()
  @MaxLength(8192)
  token: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  client_id?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  client_secret?: string;

  @IsOptional()
  @IsString()
  @IsIn(['access_token', 'refresh_token'])
  token_type_hint?: string;
}
