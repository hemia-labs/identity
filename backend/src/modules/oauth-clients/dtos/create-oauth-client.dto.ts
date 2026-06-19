import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
} from 'class-validator';
import {
  OAuthClientStatus,
  OAuthClientType,
} from '../../oauth/entities/oauth-client.entity';

export class CreateOAuthClientDto {
  @IsString()
  @MaxLength(120)
  clientId: string;

  @IsString()
  @MaxLength(160)
  audience: string;

  @IsEnum(OAuthClientType)
  type: OAuthClientType;

  @IsOptional()
  @IsArray()
  @IsUrl({ require_tld: false }, { each: true })
  redirectUris?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  grantTypes?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  responseTypes?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  scopes?: string[];

  @IsOptional()
  @IsBoolean()
  requiresConsent?: boolean;

  @IsOptional()
  @IsEnum(OAuthClientStatus)
  status?: OAuthClientStatus;
}
