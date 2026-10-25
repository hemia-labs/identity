import {
  IsBoolean,
  IsOptional,
  IsString,
  Length,
  Matches,
} from 'class-validator';
export class SaveOAuthScopeDto {
  @IsString()
  @Length(1, 160)
  @Matches(/^[\x21\x23-\x5B\x5D-\x7E]+$/)
  code: string;
  @IsString() @Length(1, 160) @Matches(/^\S+$/) audience: string;
  @IsString() @Length(1, 200) name: string;
  @IsString() @Length(0, 2000) description: string;
  @IsOptional() @IsString() @Length(1, 2048) resource?: string | null;
  @IsBoolean() enabled: boolean;
}
