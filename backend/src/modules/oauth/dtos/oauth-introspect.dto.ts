import { IsString, MaxLength } from 'class-validator';

export class OAuthIntrospectDto {
  @IsString()
  @MaxLength(120)
  client_id: string;

  @IsString()
  @MaxLength(255)
  client_secret: string;

  @IsString()
  @MaxLength(4096)
  token: string;
}
