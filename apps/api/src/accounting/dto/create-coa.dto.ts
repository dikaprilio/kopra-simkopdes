import { IsEnum, IsOptional, IsString, Matches } from 'class-validator';
import { CoaType } from '@kopra/db';

export class CreateCoaDto {
  @Matches(/^\d{6}$/, { message: 'kode harus 6 digit' })
  kode!: string;

  @IsString()
  nama!: string;

  @IsEnum(CoaType)
  type!: CoaType;

  @IsOptional() @IsString()
  parentId?: string;
}
