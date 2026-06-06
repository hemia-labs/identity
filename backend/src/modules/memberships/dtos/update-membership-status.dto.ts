import { IsEnum } from 'class-validator';
import { MembershipStatus } from '../entities/membership.entity';

export class UpdateMembershipStatusDto {
  @IsEnum(MembershipStatus)
  status: MembershipStatus;
}
