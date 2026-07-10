import type { UserRole, UserStatus } from '@kopra/db';

export interface JwtPayload {
  sub: string;
  koperasiId: string;
  role: UserRole;
  status: UserStatus;
}
