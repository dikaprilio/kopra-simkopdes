import { IsBoolean, IsEnum, IsOptional, IsString, Matches, MaxLength, MinLength, ValidateIf } from 'class-validator';
import { CoaType } from '@kopra/db';

export class CreateCoaDto {
  @Matches(/^\d{6}$/, { message: 'kode harus 6 digit' })
  kode!: string;

  @IsString() @MinLength(1) @MaxLength(150)
  nama!: string;

  @IsEnum(CoaType)
  type!: CoaType;

  @IsOptional() @IsString()
  parentId?: string;
}

export class UpdateCoaDto {
  @IsOptional() @Matches(/^\d{6}$/, { message: 'kode harus 6 digit' })
  kode?: string;

  @IsOptional() @IsString() @MinLength(1) @MaxLength(150)
  nama?: string;

  @IsOptional() @IsEnum(CoaType)
  type?: CoaType;

  @IsOptional() @ValidateIf((_object, value) => value !== null) @IsString()
  parentId?: string | null;

  @IsOptional() @IsBoolean()
  isActive?: boolean;
}
