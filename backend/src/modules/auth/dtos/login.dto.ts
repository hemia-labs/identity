import {
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';

export class LoginDto {
  @IsString()
  @MaxLength(320)
  identifier: string;

  @IsString()
  @MinLength(8)
  @MaxLength(255)
  password: string;

  @IsOptional()
  @IsUUID()
  tenantId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  deviceName?: string;
}
