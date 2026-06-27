import { IsOptional, IsString, Matches, MaxLength } from 'class-validator';

export class CreatePermissionDto {
  @IsString()
  @MaxLength(160)
  @Matches(/^(\*|[a-z0-9_]+(?:\.[a-z0-9_]+)*\.(?:[a-z0-9_]+|\*))$/)
  code: string;

  @IsString()
  @MaxLength(80)
  resource: string;

  @IsString()
  @MaxLength(80)
  action: string;

  @IsOptional()
  @IsString()
  description?: string;
}
