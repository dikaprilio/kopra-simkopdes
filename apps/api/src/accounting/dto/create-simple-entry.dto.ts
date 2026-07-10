import { IsIn, IsNumber, IsOptional, IsPositive, IsString } from 'class-validator';

export class CreateSimpleEntryDto {
  @IsIn(['INCOME', 'EXPENSE', 'STOCK_PURCHASE', 'STOCK_SALE', 'SAVING_PAYMENT'])
  kind!: 'INCOME' | 'EXPENSE' | 'STOCK_PURCHASE' | 'STOCK_SALE' | 'SAVING_PAYMENT';

  @IsNumber() @IsPositive()
  amount!: number;

  @IsString()
  description!: string;

  @IsOptional() @IsString() businessUnitId?: string;
  @IsOptional() @IsIn(['KAS', 'BANK']) via?: 'KAS' | 'BANK';
}
