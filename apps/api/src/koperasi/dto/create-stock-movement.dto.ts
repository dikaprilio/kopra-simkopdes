import { IsIn, IsNumber, IsOptional, IsPositive, IsString } from 'class-validator';
export class CreateStockMovementDto {
  @IsString() productId!: string;
  @IsIn(['IN', 'OUT', 'ADJUST']) type!: 'IN' | 'OUT' | 'ADJUST';
  @IsNumber() @IsPositive() qty!: number;
  @IsOptional() @IsNumber() @IsPositive() hargaBeli?: number;
  @IsOptional() @IsNumber() @IsPositive() hargaJual?: number;
  @IsOptional() @IsString() businessUnitId?: string;
  @IsOptional() @IsString() description?: string;
}
