import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import { MembershipStatus } from '../entities/membership.entity';

export class CreateMembershipDto {
  @IsUUID()
  userId: string;

  @IsUUID()
  tenantId: string;

  @IsOptional()
  @IsUUID()
  organizationId?: string;

  @IsOptional()
  @IsUUID()
  teamId?: string;

  @IsOptional()
  @IsEnum(MembershipStatus)
  status?: MembershipStatus;
}
