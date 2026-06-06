import { IsIn, IsOptional, IsString, IsUrl, MaxLength } from 'class-validator';

export class OAuthAuthorizeQueryDto {
  @IsString()
  @MaxLength(120)
  client_id: string;

  @IsUrl({ require_tld: false })
  redirect_uri: string;

  @IsString()
  @IsIn(['code'])
  response_type: string;

  @IsString()
  @MaxLength(500)
  scope: string;

  @IsString()
  @MaxLength(255)
  code_challenge: string;

  @IsString()
  @IsIn(['S256', 'plain'])
  code_challenge_method: string;

  @IsOptional()
  @IsString()
  @MaxLength(2048)
  state?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  nonce?: string;
}
