import { IsString, MaxLength } from 'class-validator';

export class OAuthConsentRequestQueryDto {
  @IsString()
  @MaxLength(4096)
  returnTo: string;
}
