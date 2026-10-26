import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsString,
  Length,
  Matches,
} from 'class-validator';
export class SaveOAuthApiDto {
  @IsString() @Length(1, 200) name: string;
  @IsString() @Length(1, 160) @Matches(/^\S+$/) audience: string;
  @IsString() @Length(1, 2048) resource: string;
  @IsBoolean() enabled: boolean;
  @IsArray()
  @ArrayMaxSize(100)
  @ArrayUnique()
  @IsString({ each: true })
  @Length(1, 160, { each: true })
  scopes: string[];
}
