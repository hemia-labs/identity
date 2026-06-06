import {
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class CreateOrganizationDto {
  @IsUUID()
  tenantId: string;

  @IsString()
  @MaxLength(160)
  name: string;

  @IsString()
  @MaxLength(120)
  slug: string;

  @IsOptional()
  @IsString()
  @MaxLength(240)
  legalName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  taxId?: string;

  @IsOptional()
  @IsObject()
  branding?: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  settings?: Record<string, unknown>;
}
