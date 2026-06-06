import {
  ArrayNotEmpty,
  IsArray,
  IsEnum,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
} from 'class-validator';
import { SsoClientStatus } from '../entities/sso-client.entity';

export class CreateSsoClientDto {
  @IsString()
  @MaxLength(120)
  clientId: string;

  @IsString()
  @MaxLength(160)
  name: string;

  @IsArray()
  @ArrayNotEmpty()
  @IsUrl({ require_tld: false }, { each: true })
  allowedRedirectUris: string[];

  @IsOptional()
  @IsArray()
  @IsUrl({ require_tld: false }, { each: true })
  allowedOrigins?: string[];

  @IsOptional()
  @IsEnum(SsoClientStatus)
  status?: SsoClientStatus;
}
