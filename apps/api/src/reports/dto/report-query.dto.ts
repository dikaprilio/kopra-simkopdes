import { IsIn, IsOptional, IsString, Matches } from 'class-validator';

export class RangeReportQueryDto {
  @IsOptional() @Matches(/^\d{4}-\d{2}-\d{2}$/) from?: string;
  @IsOptional() @Matches(/^\d{4}-\d{2}-\d{2}$/) to?: string;
  @IsOptional() @IsIn(['json', 'html', 'xlsx']) format?: string;
}

export class PhuReportQueryDto {
  @IsOptional() @Matches(/^\d{4}-\d{2}$/) month?: string;
  @IsOptional() @IsString() unitId?: string;
  @IsOptional() @IsIn(['json', 'html', 'xlsx']) format?: string;
}

export class NeracaReportQueryDto {
  @IsOptional() @Matches(/^\d{4}-\d{2}-\d{2}$/) date?: string;
  @IsOptional() @IsIn(['json', 'html', 'xlsx']) format?: string;
}

export class CashReportQueryDto {
  @IsOptional() @Matches(/^\d{4}-\d{2}$/) month?: string;
  @IsOptional() @IsString() kode?: string;
  @IsOptional() @IsIn(['json', 'html', 'xlsx']) format?: string;
}
