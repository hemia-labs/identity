import { IsString, MaxLength } from 'class-validator';

export class OAuthIntrospectDto {
  @IsString()
  @MaxLength(4096)
  token: string;
}
