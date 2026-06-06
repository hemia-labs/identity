import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class AssignUserRoleDto {
  @IsUUID()
  roleId: string;

  @IsOptional()
  @IsUUID()
  tenantId?: string;

  @IsOptional()
  @IsUUID()
  organizationId?: string;

  @IsOptional()
  @IsUUID()
  teamId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  systemId?: string;
}
