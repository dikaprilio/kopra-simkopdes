import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsNumber, IsOptional, IsString, Min, ValidateNested } from 'class-validator';

export class ManualLineDto {
  @IsString() coaKode!: string;
  @IsNumber() @Min(0) debit!: number;
  @IsNumber() @Min(0) kredit!: number;
}

export class CreateManualJournalDto {
  @IsString() keterangan!: string;
  @IsOptional() @IsString() referensi?: string;
  @IsOptional() @IsString() businessUnitId?: string;
  @IsArray() @ArrayMinSize(2) @ValidateNested({ each: true }) @Type(() => ManualLineDto)
  lines!: ManualLineDto[];
}
