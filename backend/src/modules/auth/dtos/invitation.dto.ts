import {
  IsOptional,
  Matches,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
export class InvitationTokenDto {
  @IsOptional() @IsString() @MinLength(40) @MaxLength(128) token?: string;
}
export class RegisterInvitationDto extends InvitationTokenDto {
  @IsString() @Matches(/\S/) @MinLength(1) @MaxLength(100) firstName: string;
  @IsString() @MaxLength(100) lastName: string;
  @IsString() @MinLength(8) @MaxLength(255) password: string;
}
