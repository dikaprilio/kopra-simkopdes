import { IsBoolean, IsNumber, IsOptional, IsPositive, IsString } from 'class-validator';
export class CreateProductDto {
  @IsString() nama!: string;
  @IsOptional() @IsString() unit?: string;
  @IsOptional() @IsString() barcode?: string;
  @IsOptional() @IsNumber() @IsPositive() hargaJual?: number;
}
export class UpdateProductDto {
  @IsOptional() @IsString() nama?: string;
  @IsOptional() @IsString() unit?: string;
  @IsOptional() @IsNumber() @IsPositive() hargaJual?: number;
  @IsOptional() @IsBoolean() isActive?: boolean;
}
