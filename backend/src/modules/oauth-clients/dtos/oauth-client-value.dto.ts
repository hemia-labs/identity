import { IsString, MaxLength } from 'class-validator';

export class OAuthClientValueDto {
  @IsString()
  @MaxLength(2048)
  value: string;
}
