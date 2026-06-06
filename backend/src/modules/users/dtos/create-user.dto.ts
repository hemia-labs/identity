import {
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  MinLength,
} from 'class-validator';
import { UserStatus } from '../entities/user.entity';

export class CreateUserDto {
  @IsEmail()
  @MaxLength(320)
  email: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  username?: string;

  @IsOptional()
  @IsString()
  @MinLength(8)
  @MaxLength(255)
  password?: string;

  @IsString()
  @MaxLength(100)
  firstName: string;

  @IsString()
  @MaxLength(100)
  lastName: string;

  @IsOptional()
  @IsUrl()
  @MaxLength(2048)
  avatarUrl?: string;

  @IsOptional()
  @IsEnum(UserStatus)
  status?: UserStatus;
}
