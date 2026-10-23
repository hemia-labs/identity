import { Equals, IsString, MaxLength, MinLength } from 'class-validator';

export const WEBHOOK_PAYLOAD_PURPOSE = 'webhook_payload_download' as const;

export class ReauthenticateDto {
  @IsString()
  @MinLength(1)
  @MaxLength(1024)
  password: string;

  @Equals(WEBHOOK_PAYLOAD_PURPOSE)
  purpose: typeof WEBHOOK_PAYLOAD_PURPOSE;
}
