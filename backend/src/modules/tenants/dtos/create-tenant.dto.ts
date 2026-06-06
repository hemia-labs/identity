import {
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { TenantStatus } from '../entities/tenant.entity';

export class CreateTenantDto {
  @IsString()
  @MaxLength(160)
  name: string;

  @IsString()
  @MaxLength(120)
  slug: string;

  @IsOptional()
  @IsEnum(TenantStatus)
  status?: TenantStatus;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  plan?: string;

  @IsOptional()
  @IsUUID()
  ownerUserId?: string;
}
