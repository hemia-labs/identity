import { IsIn, IsOptional, IsString, IsUrl, MaxLength } from 'class-validator';

export class OAuthTokenDto {
  @IsString()
  @IsIn([
    'authorization_code',
    'refresh_token',
    'client_credentials',
    'urn:ietf:params:oauth:grant-type:token-exchange',
  ])
  grant_type: string;

  @IsString()
  @MaxLength(120)
  client_id: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  client_secret?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  code?: string;

  @IsOptional()
  @IsUrl({ require_tld: false })
  redirect_uri?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  code_verifier?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  refresh_token?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  scope?: string;

  @IsOptional()
  @IsString()
  subject_token?: string;

  @IsOptional()
  @IsString()
  subject_token_type?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  audience?: string;
}
