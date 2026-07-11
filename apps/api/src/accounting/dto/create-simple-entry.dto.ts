import { IsDateString, IsIn, IsNumber, IsOptional, IsPositive, IsString } from 'class-validator';

export class CreateSimpleEntryDto {
  @IsIn(['INCOME', 'EXPENSE'])
  kind!: 'INCOME' | 'EXPENSE';

  @IsNumber() @IsPositive()
  amount!: number;

  @IsString()
  description!: string;

  @IsOptional() @IsString() businessUnitId?: string;
  @IsOptional() @IsIn(['KAS', 'BANK']) via?: 'KAS' | 'BANK';
  @IsOptional() @IsDateString() date?: string;
}
