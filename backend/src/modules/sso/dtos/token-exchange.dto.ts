import { IsString, IsUrl, MaxLength } from 'class-validator';

export class TokenExchangeDto {
  @IsString()
  @MaxLength(120)
  clientId: string;

  @IsString()
  @MaxLength(255)
  code: string;

  @IsUrl({ require_tld: false })
  redirectUri: string;
}
