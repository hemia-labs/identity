import {
  IsBoolean,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class CreateRoleDto {
  @IsOptional()
  @IsUUID()
  tenantId?: string;

  @IsString()
  @MaxLength(120)
  code: string;

  @IsString()
  @MaxLength(160)
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsBoolean()
  isSystem?: boolean;
}
