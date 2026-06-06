import { IsString, MaxLength } from 'class-validator';

export class ApproveOAuthConsentDto {
  @IsString()
  @MaxLength(4096)
  returnTo: string;
}
