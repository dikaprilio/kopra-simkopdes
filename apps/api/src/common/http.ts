import { ArgumentsHost, BadRequestException, Catch, ConflictException, ExceptionFilter, HttpException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@kopra/db';
import { DomainError, PostingError } from '@kopra/core';

/** Prisma.Decimal → string di seluruh graph respons (spec: decimal-as-string). */
export function serializeDecimals<T>(value: T): T {
  if (value instanceof Prisma.Decimal) return value.toString() as unknown as T;
  if (Array.isArray(value)) return value.map(serializeDecimals) as unknown as T;
  if (value && typeof value === 'object' && !(value instanceof Date)) {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) out[k] = serializeDecimals(v);
    return out as T;
  }
  return value;
}

export interface PageParams { page: number; pageSize: number; skip: number; take: number }
export function parsePage(page?: string, pageSize?: string): PageParams {
  const p = Math.max(1, Number(page) || 1);
  const ps = Math.min(100, Math.max(1, Number(pageSize) || 25));
  return { page: p, pageSize: ps, skip: (p - 1) * ps, take: ps };
}

const CODE_TO_HTTP: Record<string, (msg: string) => HttpException> = {
  NOT_FOUND: (m) => new NotFoundException(m),
  UNIT_MISSING: (m) => new BadRequestException(m),
  COA_MISSING: (m) => new BadRequestException(m),
  NOT_BALANCED: (m) => new BadRequestException(m),
  LINE_INVALID: (m) => new BadRequestException(m),
  LINES_MIN: (m) => new BadRequestException(m),
  AMOUNT_REQUIRED: (m) => new BadRequestException(m),
  QTY_INVALID: (m) => new BadRequestException(m),
  PRODUCT_NOT_FOUND: (m) => new NotFoundException(m),
  MEMBER_NOT_FOUND: (m) => new NotFoundException(m),
  PERIODS_REQUIRED: (m) => new BadRequestException(m),
  INSUFFICIENT_STOCK: (m) => new ConflictException(m),
  NOT_DRAFT: (m) => new ConflictException(m),
  IMMUTABLE: (m) => new ConflictException(m),
};

/** DomainError/PostingError dari core → HTTP status yang tepat. */
@Catch(DomainError, PostingError)
export class DomainErrorFilter implements ExceptionFilter {
  catch(err: DomainError | PostingError, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse();
    const http = (CODE_TO_HTTP[err.code] ?? ((m: string) => new BadRequestException(m)))(err.message);
    res.status(http.getStatus()).json({ statusCode: http.getStatus(), code: err.code, message: err.message });
  }
}
