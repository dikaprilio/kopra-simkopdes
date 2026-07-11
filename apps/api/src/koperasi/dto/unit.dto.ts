import { IsBoolean, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateUnitDto {
  @IsString() @MinLength(1) @MaxLength(150)
  nama!: string;
}

export class UpdateUnitDto {
  @IsOptional() @IsString() @MinLength(1) @MaxLength(150)
  nama?: string;

  @IsOptional() @IsBoolean()
  isActive?: boolean;
}
