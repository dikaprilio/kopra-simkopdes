import {
  IsBoolean,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';
export class CreateProductDto {
  @IsString() @MinLength(1) @MaxLength(150) nama!: string;
  @IsOptional() @IsString() @MaxLength(40) unit?: string;
  @IsOptional() @IsString() @MaxLength(100) barcode?: string;
  @IsOptional() @IsNumber() @IsPositive() hargaJual?: number;
}
export class UpdateProductDto {
  @IsOptional() @IsString() @MinLength(1) @MaxLength(150) nama?: string;
  @IsOptional() @ValidateIf((_object, value) => value !== null) @IsString() @MaxLength(40)
  unit?: string | null;
  @IsOptional() @ValidateIf((_object, value) => value !== null) @IsString() @MaxLength(100)
  barcode?: string | null;
  @IsOptional() @ValidateIf((_object, value) => value !== null) @IsNumber() @IsPositive()
  hargaJual?: number | null;
  @IsOptional() @IsBoolean() isActive?: boolean;
}
