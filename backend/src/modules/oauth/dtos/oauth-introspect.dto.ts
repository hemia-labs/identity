import { IsString, MaxLength } from 'class-validator';

export class OAuthIntrospectDto {
  @IsString()
  @MaxLength(255)
  token: string;
}
