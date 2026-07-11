import { IsDateString, IsDefined, IsIn, IsNumber, IsOptional, IsPositive, IsString, Min, ValidateIf } from 'class-validator';
export class CreateStockMovementDto {
  @IsString() productId!: string;
  @IsIn(['IN', 'OUT', 'ADJUST']) type!: 'IN' | 'OUT' | 'ADJUST';
  @ValidateIf((dto: CreateStockMovementDto) => dto.type !== 'ADJUST')
  @IsDefined() @IsNumber() @IsPositive() qty?: number;
  @ValidateIf((dto: CreateStockMovementDto) => dto.type === 'ADJUST')
  @IsDefined() @IsNumber() @Min(0) actualQty?: number;
  @IsOptional() @IsNumber() @IsPositive() hargaBeli?: number;
  @IsOptional() @IsNumber() @IsPositive() hargaJual?: number;
  @IsOptional() @IsString() businessUnitId?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsDateString() date?: string;
}
