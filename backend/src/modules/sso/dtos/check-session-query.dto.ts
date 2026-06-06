import { IsString, IsUrl, MaxLength } from 'class-validator';

export class CheckSessionQueryDto {
  @IsString()
  @MaxLength(120)
  client_id: string;

  @IsUrl({ require_tld: false })
  redirect_uri: string;
}
