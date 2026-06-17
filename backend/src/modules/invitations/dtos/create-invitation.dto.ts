import { Type } from 'class-transformer';
import {
  IsDefined,
  IsEmail,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateNested,
} from 'class-validator';

export class CreateInvitationDto {
  @IsEmail()
  email: string;

  @IsOptional()
  @IsUUID()
  organizationId?: string;

  @IsOptional()
  @IsUUID()
  teamId?: string;
}

export class InvitationEmailContextDto {
  @IsDefined()
  @IsString()
  @MaxLength(120)
  app: string;

  @IsDefined()
  @IsString()
  @MaxLength(160)
  actorName: string;

  @IsOptional()
  @IsEmail()
  actorEmail?: string;

  @IsDefined()
  @IsString()
  @MaxLength(80)
  action: string;

  @IsDefined()
  @IsString()
  @MaxLength(200)
  actionLabel: string;

  @IsDefined()
  @IsString()
  @MaxLength(160)
  resourceName: string;
}

export class ExternalCreateInvitationDto extends CreateInvitationDto {
  @IsUUID()
  tenantId: string;

  @IsDefined()
  @IsObject()
  @ValidateNested()
  @Type(() => InvitationEmailContextDto)
  emailContext: InvitationEmailContextDto;
}
