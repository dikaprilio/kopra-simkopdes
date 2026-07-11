import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';

export class MemberSavingsOnboardingDto {
  @IsOptional()
  @IsString()
  startPeriod?: string;

  @IsOptional()
  @IsNumber()
  @Min(0.01)
  pokokAmount?: number;

  @IsOptional()
  @IsNumber()
  @Min(0.01)
  wajibAmount?: number;
}

export class CreateMemberDto {
  @IsString()
  @MinLength(1)
  @MaxLength(150)
  nama!: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  nik?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  waNumber?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => MemberSavingsOnboardingDto)
  savings?: MemberSavingsOnboardingDto;
}

export class UpdateMemberDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(150)
  nama?: string;

  @IsOptional()
  @ValidateIf((_object, value) => value !== null)
  @IsString()
  @MaxLength(40)
  nik?: string | null;

  @IsOptional()
  @ValidateIf((_object, value) => value !== null)
  @IsString()
  @MaxLength(40)
  waNumber?: string | null;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
