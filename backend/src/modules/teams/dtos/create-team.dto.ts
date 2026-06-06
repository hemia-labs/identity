import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class CreateTeamDto {
  @IsUUID()
  tenantId: string;

  @IsOptional()
  @IsUUID()
  organizationId?: string;

  @IsString()
  @MaxLength(160)
  name: string;

  @IsString()
  @MaxLength(120)
  slug: string;

  @IsOptional()
  @IsString()
  description?: string;
}
