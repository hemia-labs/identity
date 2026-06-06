import { IsInt, Min } from 'class-validator';

export class SwitchAccountDto {
  @IsInt()
  @Min(0)
  accountIndex!: number;
}
