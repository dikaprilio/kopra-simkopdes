import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsDateString, IsNumber, IsOptional, IsString, MaxLength, Min, ValidateNested } from 'class-validator';

export class ManualLineDto {
  @IsString() coaKode!: string;
  @IsNumber() @Min(0) debit!: number;
  @IsNumber() @Min(0) kredit!: number;
  @IsOptional() @IsString() @MaxLength(250) catatan?: string;
}

export class CreateManualJournalDto {
  @IsString() keterangan!: string;
  @IsOptional() @IsString() referensi?: string;
  @IsOptional() @IsString() businessUnitId?: string;
  @IsOptional() @IsDateString() date?: string;
  @IsArray() @ArrayMinSize(2) @ValidateNested({ each: true }) @Type(() => ManualLineDto)
  lines!: ManualLineDto[];
}

export class ReverseJournalDto {
  @IsOptional() @IsDateString() date?: string;
  @IsOptional() @IsString() @MaxLength(250) keterangan?: string;
}
