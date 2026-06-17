import { IsOptional, IsUUID } from 'class-validator';

export class ExternalTeamsQueryDto {
  @IsUUID()
  tenantId: string;

  @IsOptional()
  @IsUUID()
  organizationId?: string;
}

export class ExternalTeamQueryDto {
  @IsOptional()
  @IsUUID()
  tenantId?: string;
}
