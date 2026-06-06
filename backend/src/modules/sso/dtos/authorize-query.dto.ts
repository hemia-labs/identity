import { IsOptional, IsString, IsUrl, MaxLength } from 'class-validator';

export class AuthorizeQueryDto {
  @IsString()
  @MaxLength(120)
  client_id: string;

  @IsUrl({ require_tld: false })
  redirect_uri: string;

  @IsOptional()
  @IsString()
  @MaxLength(2048)
  state?: string;
}
