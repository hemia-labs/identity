import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  ValidateNested,
  Matches,
  IsNotEmpty,
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

export class OAuthClientDestinationDto {
  @IsUrl({
    require_tld: false,
    protocols: ['https', 'http'],
    require_protocol: true,
  })
  @MaxLength(2048)
  @Matches(/^[^#]+$/)
  resource: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  audience: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ArrayUnique()
  @Matches(/^[\x21\x23-\x5B\x5D-\x7E]+$/, { each: true })
  @MaxLength(160, { each: true })
  scopes: string[];
}

export class CreateOAuthClientDto {
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(32)
  @ArrayUnique(
    (destination: OAuthClientDestinationDto) => destination?.resource,
  )
  @ArrayUnique(
    (destination: OAuthClientDestinationDto) => destination?.audience,
  )
  @ValidateNested({ each: true })
  @Type(() => OAuthClientDestinationDto)
  serviceDestinations?: OAuthClientDestinationDto[];

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
