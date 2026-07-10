# Kopra Fase 1 — ERP Web Stand-in (Finance + Inventory) Implementation Plan (v2)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **v2 supersedes v1 (same file, morning 11 Jul).** Between v1 and v2, Dev 2 (dika) landed **M0–M6** (`465aa0f`…`8f45f1d`): `packages/core` CONTAINS the full domain layer (policy, posting-rules, journal, stock, savings, pending-action, audit — all specs green; core relative imports now use ESM `.js` extensions), `apps/api/src/whatsapp/` has the M2 gateway + M4 DM orchestrator + M6 super-admin/guest flows, `apps/api/src/registration/` has the M6 registration service, and `packages/db` gained `ingest-rag.ts` (M5). **Do NOT rebuild or modify any of that.** Fase 1 = thin HTTP layer + web on top of the existing core.

**Goal:** Build the web ERP surrogate — a role-aware NestJS API (auth, CORE-standard accounting, inventory-lite, member savings, derived reports) and a Next.js dashboard — so a judge sees a live cooperative on real seed data with balanced official reports.

**Architecture:** `packages/core` is the single domain implementation (Prisma-coupled service functions + `DomainError`, consumed by both api and agent — dika's M1, already tested). `apps/api` adds ONLY: JWT auth, DTO validation, DomainError→HTTP mapping, and thin controllers that call core. `apps/web` (App Router) talks only to the API. New domain logic in this phase = **one new core file** (`reports.ts`) + api-level CRUD that has no rules (lists, product master data).

**Tech Stack:** Next.js 16 App Router · NestJS 11 (dev runtime `nest start --watch --exec "node --import tsx"`) · Prisma 6 / PostgreSQL 16 (Postgres.app, native, port 5432, user `postgres`, **no password**) · `@nestjs/jwt` + Argon2id · Vitest (core, serial forks vs `kopra_test`) + Jest/supertest (api) · Tailwind v4 · pnpm 9.15.0.

## Global Constraints

- **LLM explains, backend calculates.** No LLM in Fase 1; all numbers derived from journal_lines/stock_movements via SQL.
- Bahasa UI Indonesia sederhana; istilah CORE resmi: COA, Jurnal, Buku Besar, Neraca Saldo, PHU, Neraca. Buku Kas = view buku besar akun `111000`.
- **CONFIRMED journal & movement immutable** — koreksi = jurnal balik / ADJUST kompensasi. Enforcement already lives in core (`confirmEntry`, `rejectEntry`); api must not bypass it.
- Every query/mutation scoped by `koperasiId` **from the JWT**, never from the request body.
- Money Decimal(16,2), qty Decimal(16,3); **serialize Decimal as string** in JSON; dates ISO-8601; prefix `/api/v1`; lists paginated, deterministic order.
- JWT payload `{ sub, koperasiId, role, status }`; `status !== ACTIVE` → 403 `AKUN_PENDING`. Passwords Argon2id.
- Role gates use **core `can(role, capability, 'WEB')`** semantics: GETs (READ_FINANCE/READ_INVENTORY) allow `ANGGOTA`+; writes (WRITE_ERP) require `PENGURUS`/`OWNER`. Web hides write buttons for `ANGGOTA`.
- **NIK never leaves the DB** — not in responses, logs, or errors (`@kopra/core` redact exists; members endpoints simply never select it).
- **Ownership fences (CONVENTIONS.md):** do not modify `apps/agent/**` or `apps/api/src/whatsapp/**` (dika). In `packages/core`, only ADD `reports.ts`(+spec) and apply the cross-platform bugfix to `test/global-setup.ts`; do not edit dika's domain files.
- DI convention = direct `import { prisma } from '@kopra/db'` in services (match M2 style; no injection tokens).
- Commits small & frequent, no `Co-Authored-By`.
- Scope guard: CUT list `docs/00-core-features.md` §9 applies (no POS/barcode, no Excel, no user-mgmt UI, no registration/OTP — Fase 3, no groups — Fase 4).

## Key facts for executors (verified on this machine, 11 Jul)

- DB: Postgres.app 16.2 on `localhost:5432`, user `postgres`, no password (trust auth — URLs with any password also work). Databases present: `hack_the_cooperatives` (source mirror), **no `kopra` / `kopra_test` yet**.
- No `.env` at repo root yet. `apps/api/src/main.ts` already loads root `.env` via dotenv and enables `rawBody`.
- `packages/db/sql/rag_fts.sql` **missing** but `seed.ts` step 0 reads it → seed crashes without it.
- `packages/core/test/global-setup.ts` is **Windows-only** (cmd.exe/psql.exe/findstr) → core tests fail on macOS until fixed (Task 0).
- `apps/api/test/jest-e2e.json` lacks the moduleNameMapper (`@kopra/*` + the `.js`-suffix stripper for core's ESM imports) and setupFiles that the unit jest config in `apps/api/package.json` has → e2e specs importing AppModule fail to resolve workspace TS (Task 1 fixes; mirror the unit config exactly).
- GoWA v8.6.0 runs native at `localhost:3002` (basic auth `admin:kopra-dev`), launched from `Repositories/kopra-whatsapp-waha/local-gowa/`. Device paired: **API device id = UUID `2803949e-89da-41b6-890d-866d7f9f205e`** (name "elis"; the JID `6287776660466:5@s.whatsapp.net` appears in webhook payloads but is NOT accepted as `X-Device-Id`). Recorded in `local-gowa/device-id.txt`.

## Core surface consumed by this plan (dika M1 — exact signatures)

```ts
// posting-rules.ts
type EntryKind = "INCOME"|"EXPENSE"|"STOCK_PURCHASE"|"STOCK_SALE"|"SAVING_PAYMENT";
interface SimpleEntryInput { koperasiId: string; kind: EntryKind; amount?: number; description: string;
  date?: Date; businessUnitId?: string; via?: "KAS"|"BANK"; revenueCoaKode?: string;
  meta?: { productId?; qty?; hargaBeli?; hargaJual?; memberId?; periods?: string[]; savingType?: "POKOK"|"WAJIB" } }
interface PostingLine { coaKode: string; debit: number; kredit: number }
const KODE = { KAS:"111000", BANK:"112100", PERSEDIAAN:"114000", SIMPANAN_POKOK:"310000",
  SIMPANAN_WAJIB:"320000", PENDAPATAN_PENJUALAN:"410000", BEBAN_OPERASIONAL:"510000" };
buildLines(input): PostingLine[];  assertBalanced(lines): void;  class PostingError { code }

// journal.ts
createDraftFromSimple(actorId, input: SimpleEntryInput, source?: EntrySource): Promise<DraftResult> // resolves unit revenue kode itself
createManualDraft(actorId, koperasiId, header: {keterangan; referensi?; date?; businessUnitId?}, lines: PostingLine[], source?): Promise<JournalEntry & {lines}>
confirmEntry(entryId, koperasiId): Promise<void>   // atomic, cascades linked movement, duplicate-safe (throws NOT_DRAFT)
rejectEntry(entryId, koperasiId): Promise<void>    // DRAFT only (throws IMMUTABLE), deletes linked DRAFT movement
accountBalance(koperasiId, kode): Promise<number>
class DomainError { code: "COA_MISSING"|"UNIT_MISSING"|"NOT_DRAFT"|"NOT_FOUND"|"IMMUTABLE"|... }

// stock.ts
currentStock(productId): Promise<number>
stockLevels(koperasiId, lowThreshold=5): Promise<{ all: {id;nama;unit;stok}[]; low: [...] }>
createMovementDraft(actorId, { koperasiId; productId?|productQuery?; type; qty; hargaBeli?; hargaJual?; businessUnitId?; description? }, source?)
  // guards qty>0 + INSUFFICIENT_STOCK; OUT+hargaJual→linked STOCK_SALE draft; IN+hargaBeli→linked STOCK_PURCHASE draft
confirmMovementOnly(movementId, koperasiId)  // ONLY for movements WITHOUT linked journal
cancelMovement(movementId, koperasiId)

// savings.ts
paySavingDraft(actorId, { koperasiId; memberId?|memberQuery?; periods: string[]; amount: number; savingType?; via? }, source?)
  : Promise<{ member; periods; savingType; journal: DraftResult }>
markPeriodsPaid(memberId, savingType, periods, journalEntryId, amountPerPeriod?)
unpaidMembers(koperasiId): Promise<{id;nama;tunggakan;total;periods}[]>
memberSavings(memberId): Promise<MemberSaving[]>

// policy.ts
can(role: "OWNER"|"PENGURUS"|"ANGGOTA"|"GUEST"|"SUPER_ADMIN", cap, channel: "DM"|"GROUP"|"WEB"): boolean
```

## File Structure (new files only)

- `packages/db/sql/rag_fts.sql` — FTS init read by seed (Task 0).
- `packages/core/test/global-setup.ts` — cross-platform rewrite (Task 0).
- `packages/core/src/reports.ts` + `reports.spec.ts` — report aggregation SQL (Task 4); export from `index.ts`.
- `apps/api/src/common/http.ts` — DomainError→HTTP filter + Decimal serializer + pagination.
- `apps/api/src/auth/*` — module/service/controller/guards/decorators (Task 1).
- `apps/api/src/accounting/*` — coa + journals controllers/services/DTOs (Task 2).
- `apps/api/src/koperasi/*` — members/units/products/stock (Task 3).
- `apps/api/src/reports/*` — reports + dashboard controllers (Task 4).
- `apps/web/app/*` — lib + login + dashboard screens (Task 5).

---

# Task 0: Environment bring-up (this machine, once)

Makes the repo runnable+testable here: `.env`, databases, missing seed SQL, cross-platform test setup, seed data, and prove core's 43 tests pass on macOS.

**Files:**
- Create: `.env` (never committed)
- Create: `packages/db/sql/rag_fts.sql`
- Modify: `packages/core/test/global-setup.ts` (cross-platform)
- Modify: `packages/core/package.json` (add `pg` devDeps)

**Interfaces produced:** app DB `kopra` + test DB `kopra_test` on :5432; seeded demo koperasi "KDMP Palbapang (Demo)"; logins `pengurus@kopra.id` / `anggota@kopra.id` (password `kopra123`); core test suite green on macOS.

- [ ] **Step 1: Create `.env`** — `cp .env.example .env`, then set these lines (no-password native Postgres; WA device UUID from the pairing):

```
DATABASE_URL=postgresql://postgres@localhost:5432/kopra
SOURCE_DATABASE_URL=postgresql://postgres@localhost:5432/hack_the_cooperatives
JWT_SECRET=kopra-dev-8f3a1c9e2b7d4056a1e8c3f9d2b6a4e7
WA_DEVICE_ID=2803949e-89da-41b6-890d-866d7f9f205e
```

(Leave the other keys as in `.env.example`; `ANTHROPIC_API_KEY` is only needed in Fase 2.)

- [ ] **Step 2: Create databases `kopra` and `kopra_test`**

```bash
cd /Users/aliceevr/Documents/Workspace/Competition/HackTheCooperatives/Repositories/kopra-simkopdes
node -e '
const { Client } = require("./packages/db/node_modules/pg");
(async () => {
  const c = new Client({ host:"localhost", port:5432, user:"postgres", database:"postgres" });
  await c.connect();
  for (const db of ["kopra", "kopra_test"]) {
    const r = await c.query("select 1 from pg_database where datname=$1", [db]);
    if (r.rowCount === 0) { await c.query(`CREATE DATABASE ${db}`); console.log("created", db); }
    else console.log("exists", db);
  }
  await c.end();
})().catch(e => { console.error(e); process.exit(1); });
'
```

Expected: `created kopra`, `created kopra_test`.

- [ ] **Step 3: Create `packages/db/sql/rag_fts.sql`** (seed.ts splits on `;` and errors on empty statements — no trailing semicolon):

```sql
-- FTS untuk rag_documents (Prisma tak bisa express generated tsvector).
-- Config 'simple' (dictionary 'indonesian' tak tersedia di Postgres vanilla).
ALTER TABLE rag_documents ADD COLUMN IF NOT EXISTS tsv tsvector
  GENERATED ALWAYS AS (to_tsvector('simple', coalesce(title,'') || ' ' || coalesce(content,''))) STORED;
CREATE INDEX IF NOT EXISTS rag_documents_tsv_idx ON rag_documents USING GIN (tsv)
```

- [ ] **Step 4: Make `packages/core/test/global-setup.ts` cross-platform** (current version shells to `cmd.exe`/`psql.exe`/`findstr` → dies on macOS; keep behavior identical: ensure `kopra_test` exists, push schema). Replace the whole file with:

```ts
import { execSync } from "node:child_process";
import { resolve } from "node:path";

// URL DB test — password diabaikan oleh trust auth (macOS Postgres.app) tapi
// tetap ditulis utk kompatibilitas mesin dev Windows (password 'admin').
const TEST_URL =
  process.env.TEST_DATABASE_URL ?? "postgresql://postgres:admin@localhost:5432/kopra_test";

export default async function setup() {
  // buat DB test bila belum ada — pakai pg client (cross-platform, tanpa psql)
  const { Client } = await import("pg");
  const adminUrl = new URL(TEST_URL);
  const dbName = adminUrl.pathname.slice(1);
  adminUrl.pathname = "/postgres";
  const client = new Client({ connectionString: adminUrl.toString() });
  await client.connect();
  const r = await client.query("SELECT 1 FROM pg_database WHERE datname = $1", [dbName]);
  if (r.rowCount === 0) await client.query(`CREATE DATABASE ${dbName}`);
  await client.end();
  // sync schema — cwd packages/db supaya binary prisma lokal ketemu;
  // env DATABASE_URL menang atas .env (aturan precedence prisma)
  execSync("npx prisma db push --skip-generate", {
    cwd: resolve(__dirname, "../../db"),
    env: { ...process.env, DATABASE_URL: TEST_URL },
    stdio: "pipe",
  });
}
```

Add to `packages/core/package.json` devDependencies (then `pnpm install`): `"pg": "^8.13.1", "@types/pg": "^8.11.10"`.

- [ ] **Step 5: Push schema + seed + RAG ingest**

```bash
pnpm db:push && pnpm db:seed
pnpm --filter @kopra/db ingest:rag   # M5, idempotent — 39 chunks dari 15 sumber
```

Expected: seed tail `SEED SELESAI ✅  login demo: pengurus@kopra.id / kopra123`; ingest reports ~39 chunks.

- [ ] **Step 6: Verify seed counts**

```bash
node -e '
const { Client } = require("./packages/db/node_modules/pg");
(async () => {
  const c = new Client({ host:"localhost", port:5432, user:"postgres", database:"kopra" });
  await c.connect();
  const n = async (t) => (await c.query(`select count(*)::int as c from ${t}`)).rows[0].c;
  console.log({ coa: await n("coa_accounts"), units: await n("business_units"),
    members: await n("members"), savings: await n("member_savings"),
    products: await n("products"), journals: await n("journal_entries"), lines: await n("journal_lines") });
  await c.end();
})().catch(e => { console.error(e); process.exit(1); });
'
```

Expected: `{ coa: 21, units: 6, members: 15, savings: 90, products: 10, journals: 24, lines: 48 }`.

- [ ] **Step 7: Prove core tests run on macOS**

```bash
pnpm --filter @kopra/core test
```

Expected: ALL core spec files pass (domain, policy, posting-rules — 60+ tests as of M4). This validates the global-setup fix AND the whole DB toolchain.

- [ ] **Step 8: Commit (never `.env`)**

```bash
git status --short   # MUST NOT list .env
git add packages/db/sql/rag_fts.sql packages/core/test/global-setup.ts packages/core/package.json pnpm-lock.yaml
git commit -m "chore(dev): rag_fts.sql (unblock seed) + global-setup test cross-platform (macOS)"
```

---

# Task 1: Auth — login, JWT, role/status guards

**Files:**
- Modify: `apps/api/package.json` (deps) · `apps/api/test/jest-e2e.json` (mapper) · `apps/api/src/main.ts` (pipe+CORS) · `apps/api/src/app.module.ts` (import AuthModule)
- Create: `apps/api/src/auth/jwt-payload.ts`, `auth/dto/login.dto.ts`, `auth/auth.service.ts`, `auth/jwt-auth.guard.ts`, `auth/roles.decorator.ts`, `auth/roles.guard.ts`, `auth/current-user.decorator.ts`, `auth/auth.controller.ts`, `auth/auth.module.ts`
- Test: `apps/api/test/auth.e2e-spec.ts`

**Interfaces:**
- Consumes: `prisma` from `@kopra/db` (direct import, M2 convention); seeded users (Task 0).
- Produces: `JwtPayload = { sub: string; koperasiId: string; role: UserRole; status: UserStatus }` · guards `JwtAuthGuard`, `RolesGuard` + `@Roles('PENGURUS','OWNER')` + `@CurrentUser()` · `POST /api/v1/auth/login {email,password}` → `{token, user:{id,name,email,role,koperasiId}}` · `GET /api/v1/auth/me`.

- [ ] **Step 1: Add deps** (dotenv + argon2 already present since M6):

```bash
cd apps/api && pnpm add @nestjs/jwt@^11.0.0 class-validator@^0.14.1 class-transformer@^0.5.1 && cd ../..
pnpm install
```

- [ ] **Step 2: Fix `apps/api/test/jest-e2e.json`** — e2e specs import `AppModule` → `WhatsappModule` → `@kopra/*` workspace TS, which ts-jest can't resolve without the same mapper the unit config has. Replace file content with:

```json
{
  "moduleFileExtensions": ["js", "json", "ts"],
  "rootDir": ".",
  "testEnvironment": "node",
  "testRegex": ".e2e-spec.ts$",
  "setupFiles": ["<rootDir>/setup-env.ts"],
  "moduleNameMapper": {
    "^@kopra/core$": "<rootDir>/../../../packages/core/src/index.ts",
    "^@kopra/db$": "<rootDir>/../../../packages/db/src/index.ts",
    "^(\\.{1,2}/.*)\\.js$": "$1"
  },
  "transform": {
    "^.+\\.(t|j)s$": ["ts-jest", { "isolatedModules": true }]
  }
}
```

(The three mappings mirror the unit jest config in `apps/api/package.json` exactly — the `.js` stripper is required because core's relative imports are ESM `.js`-suffixed since M4.)

Note: `setup-env.ts` points `DATABASE_URL` at `kopra_test` — but auth e2e needs the seeded demo users. Add to the TOP of `auth.e2e-spec.ts` (before imports are used) an override to the dev DB **only for this spec**: see Step 3 code (`process.env.DATABASE_URL` reset + `jest.resetModules` is NOT needed because `@kopra/db` reads env at first import — the setupFile runs first, so the spec sets it back before importing AppModule via dynamic import). Simpler and reliable: the spec seeds its own users into `kopra_test` in `beforeAll` — no dependence on the demo seed, no env juggling. Step 3 does exactly that.

- [ ] **Step 3: Write failing e2e** `apps/api/test/auth.e2e-spec.ts` (self-seeding against `kopra_test`):

```ts
import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import * as argon2 from 'argon2';
import { prisma } from '@kopra/db';
import { AppModule } from '../src/app.module';

describe('Auth (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    // fixture users di kopra_test (idempotent)
    const kop = await prisma.koperasi.upsert({
      where: { sourceRef: 'KOP-E2E-AUTH' },
      update: {},
      create: { nama: 'Kop E2E Auth', sourceRef: 'KOP-E2E-AUTH', origin: 'LOCAL', status: 'ACTIVE', managementMode: 'OWNER' },
    });
    const hash = await argon2.hash('kopra123', { type: argon2.argon2id });
    await prisma.user.upsert({
      where: { email: 'e2e-pengurus@kopra.id' },
      update: { passwordHash: hash, koperasiId: kop.id, role: 'PENGURUS', status: 'ACTIVE' },
      create: { email: 'e2e-pengurus@kopra.id', passwordHash: hash, name: 'E2E Pengurus', role: 'PENGURUS', status: 'ACTIVE', koperasiId: kop.id },
    });
    await prisma.user.upsert({
      where: { email: 'e2e-anggota@kopra.id' },
      update: { passwordHash: hash, koperasiId: kop.id, role: 'ANGGOTA', status: 'ACTIVE' },
      create: { email: 'e2e-anggota@kopra.id', passwordHash: hash, name: 'E2E Anggota', role: 'ANGGOTA', status: 'ACTIVE', koperasiId: kop.id },
    });

    const mod = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = mod.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
  });

  afterAll(async () => { await app?.close(); await prisma.$disconnect(); });

  it('login pengurus → JWT + role, tanpa nik/passwordHash', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'e2e-pengurus@kopra.id', password: 'kopra123' })
      .expect(201);
    expect(res.body.token).toEqual(expect.any(String));
    expect(res.body.user.role).toBe('PENGURUS');
    expect(res.body.user).not.toHaveProperty('nik');
    expect(res.body.user).not.toHaveProperty('passwordHash');
  });

  it('password salah → 401', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'e2e-pengurus@kopra.id', password: 'salah' })
      .expect(401);
  });

  it('GET /auth/me butuh bearer valid', async () => {
    const login = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'e2e-anggota@kopra.id', password: 'kopra123' });
    const me = await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${login.body.token}`)
      .expect(200);
    expect(me.body.role).toBe('ANGGOTA');
    await request(app.getHttpServer()).get('/api/v1/auth/me').expect(401);
  });
});
```

- [ ] **Step 4: Run to verify failure** — `pnpm --filter api test:e2e -- auth.e2e-spec` → FAIL (no auth routes / missing files).

- [ ] **Step 5: Implement auth files** (all under `apps/api/src/auth/`; direct prisma import, no DI token):

`jwt-payload.ts`:

```ts
import type { UserRole, UserStatus } from '@kopra/db';

export interface JwtPayload {
  sub: string;
  koperasiId: string;
  role: UserRole;
  status: UserStatus;
}
```

`dto/login.dto.ts`:

```ts
import { IsEmail, IsString, MinLength } from 'class-validator';

export class LoginDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(1)
  password!: string;
}
```

`auth.service.ts`:

```ts
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { prisma } from '@kopra/db';
import type { JwtPayload } from './jwt-payload';

@Injectable()
export class AuthService {
  constructor(private readonly jwt: JwtService) {}

  async login(email: string, password: string) {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !user.koperasiId) throw new UnauthorizedException('KREDENSIAL_SALAH');
    const ok = await argon2.verify(user.passwordHash, password);
    if (!ok) throw new UnauthorizedException('KREDENSIAL_SALAH');
    const payload: JwtPayload = { sub: user.id, koperasiId: user.koperasiId, role: user.role, status: user.status };
    return {
      token: await this.jwt.signAsync(payload),
      user: { id: user.id, name: user.name, email: user.email, role: user.role, koperasiId: user.koperasiId },
    };
  }

  async me(userId: string) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException();
    return { id: user.id, name: user.name, email: user.email, role: user.role, koperasiId: user.koperasiId };
  }
}
```

`jwt-auth.guard.ts`:

```ts
import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { JwtPayload } from './jwt-payload';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly jwt: JwtService) {}
  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest();
    const header: string | undefined = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) throw new UnauthorizedException();
    try {
      req.user = await this.jwt.verifyAsync<JwtPayload>(header.slice(7));
      return true;
    } catch {
      throw new UnauthorizedException();
    }
  }
}
```

`roles.decorator.ts`:

```ts
import { SetMetadata } from '@nestjs/common';
import type { UserRole } from '@kopra/db';

export const ROLES_KEY = 'roles';
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);
```

`roles.guard.ts` (also enforces ACTIVE status — the 403 `AKUN_PENDING` rule):

```ts
import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { UserRole } from '@kopra/db';
import { ROLES_KEY } from './roles.decorator';
import type { JwtPayload } from './jwt-payload';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}
  canActivate(ctx: ExecutionContext): boolean {
    const user = ctx.switchToHttp().getRequest().user as JwtPayload;
    if (user.status !== 'ACTIVE') throw new ForbiddenException('AKUN_PENDING');
    const required = this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [ctx.getHandler(), ctx.getClass()]);
    if (!required?.length) return true;
    if (!required.includes(user.role)) throw new ForbiddenException('PERAN_TIDAK_CUKUP');
    return true;
  }
}
```

`current-user.decorator.ts`:

```ts
import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { JwtPayload } from './jwt-payload';

export const CurrentUser = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): JwtPayload => ctx.switchToHttp().getRequest().user,
);
```

`auth.controller.ts`:

```ts
import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { JwtAuthGuard } from './jwt-auth.guard';
import { CurrentUser } from './current-user.decorator';
import type { JwtPayload } from './jwt-payload';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.auth.login(dto.email, dto.password);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  me(@CurrentUser() user: JwtPayload) {
    return this.auth.me(user.sub);
  }
}
```

`auth.module.ts`:

```ts
import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtAuthGuard } from './jwt-auth.guard';
import { RolesGuard } from './roles.guard';

@Module({
  imports: [
    JwtModule.register({
      global: true,
      secret: process.env.JWT_SECRET ?? 'dev-secret',
      signOptions: { expiresIn: '12h' },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtAuthGuard, RolesGuard],
  exports: [JwtAuthGuard, RolesGuard],
})
export class AuthModule {}
```

- [ ] **Step 6: Wire without touching M2 pieces.** `app.module.ts` → add `AuthModule` to imports (keep `WhatsappModule`, `AppController`, `AppService` as-is). `main.ts` → keep dotenv/rawBody/prefix lines, add pipe + CORS after `create(...)`:

```ts
app.enableCors({ origin: process.env.APP_PUBLIC_WEB_URL ?? 'http://localhost:3000' });
app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
```

(import `ValidationPipe` from `@nestjs/common`).

- [ ] **Step 7: Run e2e to green** — `pnpm --filter api test:e2e -- auth.e2e-spec` → PASS (3). Also re-run M2 unit suite untouched: `pnpm --filter api test` → 12 tests still green.

- [ ] **Step 8: Commit**

```bash
git add apps/api pnpm-lock.yaml
git commit -m "feat(api): auth login + JWT + role/status guards; jest-e2e resolve @kopra workspace"
```

---

# Task 2: Accounting HTTP — COA + journals over core

Thin HTTP on top of `@kopra/core` journal functions. New logic = none (except PATCH draft replace, which composes core's `assertBalanced`).

**Files:**
- Create: `apps/api/src/common/http.ts`
- Create: `apps/api/src/accounting/dto/create-coa.dto.ts`, `dto/create-simple-entry.dto.ts`, `dto/create-manual-journal.dto.ts`
- Create: `apps/api/src/accounting/coa.service.ts`, `coa.controller.ts`, `journal.service.ts`, `journal.controller.ts`, `accounting.module.ts`
- Modify: `apps/api/src/app.module.ts`
- Test: `apps/api/src/accounting/journal.http.spec.ts` (unit-style, vs `kopra_test`)

**Interfaces:**
- Consumes: core `createDraftFromSimple`, `createManualDraft`, `confirmEntry`, `rejectEntry`, `assertBalanced`, `DomainError`, `PostingError`; guards from Task 1.
- Produces endpoints (auth required; writes `@Roles('PENGURUS','OWNER')`):
  - `GET /coa?tree=true` · `POST /coa {kode,nama,type,parentId?}`
  - `GET /journals?month=&unitId=&status=&source=&page=&pageSize=` · `GET /journals/:id`
  - `POST /journals/simple {kind,amount,description,businessUnitId?,via?}` → DRAFT via posting rules
  - `POST /journals {keterangan,referensi?,businessUnitId?,lines:[{coaKode,debit,kredit}]}` → manual DRAFT
  - `PATCH /journals/:id` (DRAFT only, same body as manual) · `POST /journals/:id/confirm` · `DELETE /journals/:id` (DRAFT only)

- [ ] **Step 1: `apps/api/src/common/http.ts`** — one place for Decimal serialization, pagination, and DomainError mapping:

```ts
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
```

Register the filter globally in `main.ts` after the pipe: `app.useGlobalFilters(new DomainErrorFilter());` (import from `./common/http`).

- [ ] **Step 2: DTOs** (`apps/api/src/accounting/dto/`):

`create-coa.dto.ts`:

```ts
import { IsEnum, IsOptional, IsString, Matches } from 'class-validator';
import { CoaType } from '@kopra/db';

export class CreateCoaDto {
  @Matches(/^\d{6}$/, { message: 'kode harus 6 digit' })
  kode!: string;

  @IsString()
  nama!: string;

  @IsEnum(CoaType)
  type!: CoaType;

  @IsOptional() @IsString()
  parentId?: string;
}
```

`create-simple-entry.dto.ts` (mirrors core `SimpleEntryInput`, minus koperasiId which comes from JWT):

```ts
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
```

`create-manual-journal.dto.ts` (lines by `coaKode`, matching core `PostingLine`):

```ts
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
```

- [ ] **Step 3: COA service + controller**

`coa.service.ts`:

```ts
import { ConflictException, Injectable } from '@nestjs/common';
import { prisma } from '@kopra/db';
import { CreateCoaDto } from './dto/create-coa.dto';

@Injectable()
export class CoaService {
  async list(koperasiId: string, tree: boolean) {
    const accounts = await prisma.coaAccount.findMany({ where: { koperasiId }, orderBy: { kode: 'asc' } });
    if (!tree) return accounts;
    type Node = (typeof accounts)[number] & { children: Node[] };
    const byId = new Map<string, Node>(accounts.map((a) => [a.id, { ...a, children: [] }]));
    const roots: Node[] = [];
    for (const node of byId.values()) {
      if (node.parentId && byId.has(node.parentId)) byId.get(node.parentId)!.children.push(node);
      else roots.push(node);
    }
    return roots;
  }

  async create(koperasiId: string, dto: CreateCoaDto) {
    const exists = await prisma.coaAccount.findUnique({
      where: { koperasiId_kode: { koperasiId, kode: dto.kode } },
    });
    if (exists) throw new ConflictException('KODE_COA_SUDAH_ADA');
    return prisma.coaAccount.create({
      data: { koperasiId, kode: dto.kode, nama: dto.nama, type: dto.type, parentId: dto.parentId ?? null },
    });
  }
}
```

`coa.controller.ts`:

```ts
import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CurrentUser } from '../auth/current-user.decorator';
import type { JwtPayload } from '../auth/jwt-payload';
import { CoaService } from './coa.service';
import { CreateCoaDto } from './dto/create-coa.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('coa')
export class CoaController {
  constructor(private readonly coa: CoaService) {}

  @Get() // read: semua role login (transparansi ANGGOTA)
  list(@CurrentUser() u: JwtPayload, @Query('tree') tree?: string) {
    return this.coa.list(u.koperasiId, tree === 'true');
  }

  @Post()
  @Roles('PENGURUS', 'OWNER')
  create(@CurrentUser() u: JwtPayload, @Body() dto: CreateCoaDto) {
    return this.coa.create(u.koperasiId, dto);
  }
}
```

- [ ] **Step 4: Journal service** `journal.service.ts` — list/get are api-level reads; create/confirm/reject DELEGATE to core; PATCH composes core validation:

```ts
import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, prisma } from '@kopra/db';
import {
  assertBalanced, createDraftFromSimple, createManualDraft, confirmEntry, rejectEntry,
  type PostingLine,
} from '@kopra/core';
import { parsePage, serializeDecimals } from '../common/http';
import { CreateSimpleEntryDto } from './dto/create-simple-entry.dto';
import { CreateManualJournalDto } from './dto/create-manual-journal.dto';

const INCLUDE = { lines: { include: { coa: true } }, businessUnit: true } as const;

@Injectable()
export class JournalService {
  async list(koperasiId: string, q: { month?: string; unitId?: string; status?: string; source?: string; page?: string; pageSize?: string }) {
    const { skip, take, page, pageSize } = parsePage(q.page, q.pageSize);
    const where: Prisma.JournalEntryWhereInput = { koperasiId };
    if (q.unitId) where.businessUnitId = q.unitId;
    if (q.status === 'DRAFT' || q.status === 'CONFIRMED') where.status = q.status;
    if (q.source) where.sourceChannel = q.source as Prisma.JournalEntryWhereInput['sourceChannel'];
    if (q.month) {
      const [y, m] = q.month.split('-').map(Number);
      where.date = { gte: new Date(y, m - 1, 1), lt: new Date(y, m, 1) };
    }
    const [rows, total] = await Promise.all([
      prisma.journalEntry.findMany({ where, orderBy: [{ date: 'desc' }, { nomor: 'desc' }], skip, take, include: INCLUDE }),
      prisma.journalEntry.count({ where }),
    ]);
    return { data: serializeDecimals(rows), page, pageSize, total };
  }

  async get(koperasiId: string, id: string) {
    const entry = await prisma.journalEntry.findFirst({ where: { id, koperasiId }, include: INCLUDE });
    if (!entry) throw new NotFoundException('JURNAL_TIDAK_DITEMUKAN');
    return serializeDecimals(entry);
  }

  async createSimple(koperasiId: string, actorId: string, dto: CreateSimpleEntryDto) {
    const { entry } = await createDraftFromSimple(
      actorId,
      { koperasiId, kind: dto.kind, amount: dto.amount, description: dto.description, businessUnitId: dto.businessUnitId, via: dto.via },
      'WEB',
    );
    return this.get(koperasiId, entry.id);
  }

  async createManual(koperasiId: string, actorId: string, dto: CreateManualJournalDto) {
    const entry = await createManualDraft(
      actorId, koperasiId,
      { keterangan: dto.keterangan, referensi: dto.referensi, businessUnitId: dto.businessUnitId },
      dto.lines as PostingLine[],
      'WEB',
    );
    return this.get(koperasiId, entry.id);
  }

  /** PATCH draft: replace header+lines. Guard DRAFT; balance via core.assertBalanced. */
  async updateDraft(koperasiId: string, id: string, dto: CreateManualJournalDto) {
    assertBalanced(dto.lines as PostingLine[]);
    const kodes = [...new Set(dto.lines.map((l) => l.coaKode))];
    return prisma.$transaction(async (tx) => {
      const entry = await tx.journalEntry.findFirst({ where: { id, koperasiId } });
      if (!entry) throw new NotFoundException('JURNAL_TIDAK_DITEMUKAN');
      if (entry.status !== 'DRAFT') throw new ConflictException('JURNAL_TERKONFIRMASI_IMMUTABLE');
      const accounts = await tx.coaAccount.findMany({ where: { koperasiId, kode: { in: kodes }, isActive: true } });
      const byKode = new Map(accounts.map((a) => [a.kode, a.id]));
      const missing = kodes.filter((k) => !byKode.has(k));
      if (missing.length) throw new NotFoundException(`AKUN_COA_HILANG: ${missing.join(',')}`);
      await tx.journalLine.deleteMany({ where: { entryId: id } });
      const updated = await tx.journalEntry.update({
        where: { id },
        data: {
          keterangan: dto.keterangan, referensi: dto.referensi ?? null, businessUnitId: dto.businessUnitId ?? null,
          lines: { create: dto.lines.map((l) => ({ coaId: byKode.get(l.coaKode)!, debit: l.debit, kredit: l.kredit })) },
        },
        include: INCLUDE,
      });
      return serializeDecimals(updated);
    });
  }

  async confirm(koperasiId: string, id: string) {
    await confirmEntry(id, koperasiId); // DomainError NOT_DRAFT → 409 via filter
    return this.get(koperasiId, id);
  }

  async remove(koperasiId: string, id: string) {
    await rejectEntry(id, koperasiId); // NOT_FOUND → 404, IMMUTABLE → 409 via filter
    return { deleted: true };
  }
}
```

- [ ] **Step 5: Journal controller** `journal.controller.ts`:

```ts
import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CurrentUser } from '../auth/current-user.decorator';
import type { JwtPayload } from '../auth/jwt-payload';
import { JournalService } from './journal.service';
import { CreateSimpleEntryDto } from './dto/create-simple-entry.dto';
import { CreateManualJournalDto } from './dto/create-manual-journal.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('journals')
export class JournalController {
  constructor(private readonly journal: JournalService) {}

  @Get()
  list(@CurrentUser() u: JwtPayload, @Query() q: Record<string, string>) {
    return this.journal.list(u.koperasiId, q);
  }

  @Get(':id')
  get(@CurrentUser() u: JwtPayload, @Param('id') id: string) {
    return this.journal.get(u.koperasiId, id);
  }

  @Post('simple')
  @Roles('PENGURUS', 'OWNER')
  createSimple(@CurrentUser() u: JwtPayload, @Body() dto: CreateSimpleEntryDto) {
    return this.journal.createSimple(u.koperasiId, u.sub, dto);
  }

  @Post()
  @Roles('PENGURUS', 'OWNER')
  createManual(@CurrentUser() u: JwtPayload, @Body() dto: CreateManualJournalDto) {
    return this.journal.createManual(u.koperasiId, u.sub, dto);
  }

  @Patch(':id')
  @Roles('PENGURUS', 'OWNER')
  update(@CurrentUser() u: JwtPayload, @Param('id') id: string, @Body() dto: CreateManualJournalDto) {
    return this.journal.updateDraft(u.koperasiId, id, dto);
  }

  @Post(':id/confirm')
  @Roles('PENGURUS', 'OWNER')
  confirm(@CurrentUser() u: JwtPayload, @Param('id') id: string) {
    return this.journal.confirm(u.koperasiId, id);
  }

  @Delete(':id')
  @Roles('PENGURUS', 'OWNER')
  remove(@CurrentUser() u: JwtPayload, @Param('id') id: string) {
    return this.journal.remove(u.koperasiId, id);
  }
}
```

`accounting.module.ts`:

```ts
import { Module } from '@nestjs/common';
import { CoaController } from './coa.controller';
import { CoaService } from './coa.service';
import { JournalController } from './journal.controller';
import { JournalService } from './journal.service';

@Module({
  controllers: [CoaController, JournalController],
  providers: [CoaService, JournalService],
  exports: [JournalService],
})
export class AccountingModule {}
```

Add `AccountingModule` to `app.module.ts` imports.

- [ ] **Step 6: Write the service spec** `apps/api/src/accounting/journal.http.spec.ts` (runs on `kopra_test` via setup-env; fixture pattern = mirror `packages/core/src/domain.spec.ts` beforeAll — delete tables in FK order, create koperasi+COA(DEFAULT_COA)+unit+user):

```ts
/** HTTP-layer spec utk JournalService — jalur create→confirm→immutable via service. */
import { prisma } from '@kopra/db';
import { DEFAULT_COA } from '../../../../packages/db/src/coa-default';
import { JournalService } from './journal.service';

let kopId = '', userId = '';
const svc = new JournalService();

beforeAll(async () => {
  for (const t of [
    'pending_actions', 'member_savings', 'stock_movements', 'journal_lines',
    'journal_entries', 'products', 'members', 'business_units', 'coa_accounts',
    'whatsapp_identities', 'users', 'koperasi',
  ]) await prisma.$executeRawUnsafe(`DELETE FROM ${t}`);
  const kop = await prisma.koperasi.create({ data: { nama: 'Kop HTTP Test', origin: 'LOCAL', status: 'ACTIVE', managementMode: 'OWNER' } });
  kopId = kop.id;
  const byKode = new Map<string, string>();
  for (const c of DEFAULT_COA) {
    const r = await prisma.coaAccount.create({ data: { koperasiId: kopId, kode: c.kode, nama: c.nama, type: c.type, parentId: c.parentKode ? byKode.get(c.parentKode) : undefined } });
    byKode.set(c.kode, r.id);
  }
  const user = await prisma.user.create({ data: { email: 'http@t.id', passwordHash: 'x', name: 'T', role: 'PENGURUS', status: 'ACTIVE', koperasiId: kopId } });
  userId = user.id;
});

afterAll(async () => { await prisma.$disconnect(); });

it('simple INCOME → DRAFT 2 lines, decimals as strings', async () => {
  const entry: any = await svc.createSimple(kopId, userId, { kind: 'INCOME', amount: 500000, description: 'pemasukan tes' } as any);
  expect(entry.status).toBe('DRAFT');
  expect(entry.lines).toHaveLength(2);
  expect(typeof entry.lines[0].debit).toBe('string');
});

it('confirm → CONFIRMED; PATCH/DELETE terkunci (409)', async () => {
  const entry: any = await svc.createSimple(kopId, userId, { kind: 'EXPENSE', amount: 100000, description: 'beban tes' } as any);
  const confirmed: any = await svc.confirm(kopId, entry.id);
  expect(confirmed.status).toBe('CONFIRMED');
  await expect(svc.confirm(kopId, entry.id)).rejects.toMatchObject({ code: 'NOT_DRAFT' });
  await expect(svc.remove(kopId, entry.id)).rejects.toMatchObject({ code: 'IMMUTABLE' });
});

it('manual unbalanced → PostingError NOT_BALANCED', async () => {
  await expect(
    svc.createManual(kopId, userId, { keterangan: 'x', lines: [
      { coaKode: '111000', debit: 100, kredit: 0 },
      { coaKode: '410000', debit: 0, kredit: 50 },
    ] } as any),
  ).rejects.toMatchObject({ code: 'NOT_BALANCED' });
});
```

- [ ] **Step 7: Run specs** — `pnpm --filter api test -- journal.http` → 3 PASS (plus M2's 12 still green with `pnpm --filter api test`).

- [ ] **Step 8: Live curl check against seeded dev DB** (`pnpm dev:api` in another terminal):

```bash
TOKEN=$(curl -s localhost:3001/api/v1/auth/login -H 'content-type: application/json' -d '{"email":"pengurus@kopra.id","password":"kopra123"}' | node -pe 'JSON.parse(require("fs").readFileSync(0)).token')
curl -s "localhost:3001/api/v1/coa?tree=true" -H "authorization: Bearer $TOKEN" | head -c 200; echo
DRAFT=$(curl -s localhost:3001/api/v1/journals/simple -H "authorization: Bearer $TOKEN" -H 'content-type: application/json' -d '{"kind":"INCOME","amount":500000,"description":"catat pemasukan banyu 500rb"}')
ID=$(echo "$DRAFT" | node -pe 'JSON.parse(require("fs").readFileSync(0)).id')
curl -s -X POST localhost:3001/api/v1/journals/$ID/confirm -H "authorization: Bearer $TOKEN" | node -pe 'JSON.parse(require("fs").readFileSync(0)).status'   # CONFIRMED
ATOK=$(curl -s localhost:3001/api/v1/auth/login -H 'content-type: application/json' -d '{"email":"anggota@kopra.id","password":"kopra123"}' | node -pe 'JSON.parse(require("fs").readFileSync(0)).token')
curl -s -o /dev/null -w '%{http_code}\n' localhost:3001/api/v1/journals/simple -X POST -H "authorization: Bearer $ATOK" -H 'content-type: application/json' -d '{"kind":"INCOME","amount":1,"description":"x"}'   # 403
```

- [ ] **Step 9: Commit** — `git add apps/api/src && git commit -m "feat(api): COA + journals HTTP atas @kopra/core (simple/manual/patch/confirm/reject, DomainError filter)"`

---

# Task 3: Master data HTTP — members+savings (rapel), units, products, stock

**Files:**
- Create: `apps/api/src/koperasi/dto/pay-savings.dto.ts`, `dto/product.dto.ts`, `dto/create-stock-movement.dto.ts`
- Create: `apps/api/src/koperasi/members.service.ts`, `members.controller.ts`, `units.controller.ts`, `products.service.ts`, `products.controller.ts`, `stock.service.ts`, `stock.controller.ts`, `koperasi.module.ts`
- Modify: `apps/api/src/app.module.ts`

**Interfaces:**
- Consumes: core `memberSavings`, `unpaidMembers`, `paySavingDraft`, `markPeriodsPaid`, `confirmEntry`, `stockLevels`, `currentStock`, `createMovementDraft`, `confirmMovementOnly`; guards Task 1; helpers Task 2.
- Produces:
  - `GET /members?search=&unpaid=&page=` (never selects `nik`) · `GET /members/:id/simpanan` · `POST /members/:id/simpanan/pay {savingIds[]}` — rapel: one confirmed SAVING_PAYMENT journal + periods PAID
  - `GET /business-units`
  - `GET /products` (with `stok` per product) · `GET /products/:id/card` · `POST/PATCH /products/:id` · `DELETE /products/:id` (movement guard → `isActive=false`)
  - `GET /stock-movements?productId=` · `POST /stock-movements` (core draft; auto-linked journal for sale/purchase) · `POST /stock-movements/:id/confirm` (linked journal → `confirmEntry` cascades both; else `confirmMovementOnly`)

- [ ] **Step 1: DTOs** (`apps/api/src/koperasi/dto/`):

`pay-savings.dto.ts`:

```ts
import { ArrayMinSize, IsArray, IsString } from 'class-validator';
export class PaySavingsDto {
  @IsArray() @ArrayMinSize(1) @IsString({ each: true })
  savingIds!: string[];
}
```

`product.dto.ts`:

```ts
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
```

`create-stock-movement.dto.ts`:

```ts
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
```

- [ ] **Step 2: Members service** `members.service.ts` — pay = core draft → confirm → mark PAID (same semantics as WA `confirmPending` SAVING_PAY branch):

```ts
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, prisma } from '@kopra/db';
import { confirmEntry, markPeriodsPaid, memberSavings, paySavingDraft } from '@kopra/core';
import { parsePage, serializeDecimals } from '../common/http';

@Injectable()
export class MembersService {
  async list(koperasiId: string, q: { search?: string; unpaid?: string; page?: string; pageSize?: string }) {
    const { skip, take, page, pageSize } = parsePage(q.page, q.pageSize);
    const where: Prisma.MemberWhereInput = { koperasiId };
    if (q.search) where.nama = { contains: q.search, mode: 'insensitive' };
    if (q.unpaid === 'true') where.savings = { some: { status: 'UNPAID' } };
    const [rows, total] = await Promise.all([
      prisma.member.findMany({
        where, orderBy: { nama: 'asc' }, skip, take,
        select: { id: true, nama: true, waNumber: true, _count: { select: { savings: { where: { status: 'UNPAID' } } } } }, // no nik!
      }),
      prisma.member.count({ where }),
    ]);
    return { data: rows.map((m) => ({ id: m.id, nama: m.nama, waNumber: m.waNumber, unpaidCount: m._count.savings })), page, pageSize, total };
  }

  async savings(koperasiId: string, memberId: string) {
    const member = await prisma.member.findFirst({ where: { id: memberId, koperasiId }, select: { id: true, nama: true } });
    if (!member) throw new NotFoundException('ANGGOTA_TIDAK_DITEMUKAN');
    return serializeDecimals({ member, savings: await memberSavings(memberId) });
  }

  /** Rapel: bayar beberapa periode UNPAID sekaligus → satu jurnal confirmed + PAID. */
  async pay(koperasiId: string, actorId: string, memberId: string, savingIds: string[]) {
    const member = await prisma.member.findFirst({ where: { id: memberId, koperasiId } });
    if (!member) throw new NotFoundException('ANGGOTA_TIDAK_DITEMUKAN');
    const savings = await prisma.memberSaving.findMany({ where: { id: { in: savingIds }, memberId, status: 'UNPAID' } });
    if (!savings.length) throw new BadRequestException('TIDAK_ADA_PERIODE_UNPAID');
    const types = new Set(savings.map((s) => s.type));
    if (types.size > 1) throw new BadRequestException('CAMPUR_TIPE_SIMPANAN');
    const savingType = savings[0].type as 'POKOK' | 'WAJIB';
    const periods = savings.map((s) => s.period).sort();
    const total = savings.reduce((a, s) => a + Number(s.amount), 0);

    const draft = await paySavingDraft(actorId, { koperasiId, memberId, periods, amount: total, savingType }, 'WEB');
    await confirmEntry(draft.journal.entry.id, koperasiId);
    await markPeriodsPaid(memberId, savingType, periods, draft.journal.entry.id, Number(savings[0].amount));
    return { paid: periods.length, total: String(total), journalId: draft.journal.entry.id, nomor: draft.journal.entry.nomor };
  }
}
```

- [ ] **Step 3: Members + units controllers**

`members.controller.ts`:

```ts
import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CurrentUser } from '../auth/current-user.decorator';
import type { JwtPayload } from '../auth/jwt-payload';
import { MembersService } from './members.service';
import { PaySavingsDto } from './dto/pay-savings.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('members')
export class MembersController {
  constructor(private readonly members: MembersService) {}

  @Get()
  list(@CurrentUser() u: JwtPayload, @Query() q: Record<string, string>) {
    return this.members.list(u.koperasiId, q);
  }

  @Get(':id/simpanan')
  savings(@CurrentUser() u: JwtPayload, @Param('id') id: string) {
    return this.members.savings(u.koperasiId, id);
  }

  @Post(':id/simpanan/pay')
  @Roles('PENGURUS', 'OWNER')
  pay(@CurrentUser() u: JwtPayload, @Param('id') id: string, @Body() dto: PaySavingsDto) {
    return this.members.pay(u.koperasiId, u.sub, id, dto.savingIds);
  }
}
```

`units.controller.ts`:

```ts
import { Controller, Get, UseGuards } from '@nestjs/common';
import { prisma } from '@kopra/db';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { JwtPayload } from '../auth/jwt-payload';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('business-units')
export class UnitsController {
  @Get()
  list(@CurrentUser() u: JwtPayload) {
    return prisma.businessUnit.findMany({ where: { koperasiId: u.koperasiId }, orderBy: { nama: 'asc' } });
  }
}
```

- [ ] **Step 4: Products service + controller** (list joins core `stockLevels`; delete-guard → inactive):

`products.service.ts`:

```ts
import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { prisma } from '@kopra/db';
import { currentStock, stockLevels } from '@kopra/core';
import { serializeDecimals } from '../common/http';
import { CreateProductDto, UpdateProductDto } from './dto/product.dto';

@Injectable()
export class ProductsService {
  async list(koperasiId: string, search?: string) {
    const { all } = await stockLevels(koperasiId); // produk aktif + stok
    const stokById = new Map(all.map((r) => [r.id, r.stok]));
    const products = await prisma.product.findMany({
      where: { koperasiId, ...(search ? { nama: { contains: search, mode: 'insensitive' } } : {}) },
      orderBy: { nama: 'asc' },
    });
    return products.map((p) => ({
      id: p.id, nama: p.nama, unit: p.unit, barcode: p.barcode, isActive: p.isActive,
      hargaJual: p.hargaJual?.toString() ?? null, stok: stokById.get(p.id) ?? 0,
    }));
  }

  async card(koperasiId: string, id: string) {
    const product = await prisma.product.findFirst({ where: { id, koperasiId } });
    if (!product) throw new NotFoundException('PRODUK_TIDAK_DITEMUKAN');
    const [stok, movements] = await Promise.all([
      currentStock(id),
      prisma.stockMovement.findMany({ where: { productId: id }, orderBy: { date: 'desc' } }),
    ]);
    return serializeDecimals({
      product: { id: product.id, nama: product.nama, unit: product.unit, hargaJual: product.hargaJual },
      stok, movements,
    });
  }

  async create(koperasiId: string, dto: CreateProductDto) {
    const exists = await prisma.product.findUnique({ where: { koperasiId_nama: { koperasiId, nama: dto.nama } } });
    if (exists) throw new ConflictException('PRODUK_SUDAH_ADA');
    return serializeDecimals(await prisma.product.create({
      data: { koperasiId, nama: dto.nama, unit: dto.unit, barcode: dto.barcode, hargaJual: dto.hargaJual },
    }));
  }

  async update(koperasiId: string, id: string, dto: UpdateProductDto) {
    const product = await prisma.product.findFirst({ where: { id, koperasiId } });
    if (!product) throw new NotFoundException('PRODUK_TIDAK_DITEMUKAN');
    return serializeDecimals(await prisma.product.update({
      where: { id },
      data: { nama: dto.nama, unit: dto.unit, isActive: dto.isActive, hargaJual: dto.hargaJual },
    }));
  }

  /** Delete-guard: produk ber-movement tidak dihapus — inactive. */
  async remove(koperasiId: string, id: string) {
    const product = await prisma.product.findFirst({ where: { id, koperasiId } });
    if (!product) throw new NotFoundException('PRODUK_TIDAK_DITEMUKAN');
    const count = await prisma.stockMovement.count({ where: { productId: id } });
    if (count > 0) {
      await prisma.product.update({ where: { id }, data: { isActive: false } });
      return { inactivated: true };
    }
    await prisma.product.delete({ where: { id } });
    return { deleted: true };
  }
}
```

`products.controller.ts`:

```ts
import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CurrentUser } from '../auth/current-user.decorator';
import type { JwtPayload } from '../auth/jwt-payload';
import { ProductsService } from './products.service';
import { CreateProductDto, UpdateProductDto } from './dto/product.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('products')
export class ProductsController {
  constructor(private readonly products: ProductsService) {}

  @Get()
  list(@CurrentUser() u: JwtPayload, @Query('search') search?: string) {
    return this.products.list(u.koperasiId, search);
  }

  @Get(':id/card')
  card(@CurrentUser() u: JwtPayload, @Param('id') id: string) {
    return this.products.card(u.koperasiId, id);
  }

  @Post()
  @Roles('PENGURUS', 'OWNER')
  create(@CurrentUser() u: JwtPayload, @Body() dto: CreateProductDto) {
    return this.products.create(u.koperasiId, dto);
  }

  @Patch(':id')
  @Roles('PENGURUS', 'OWNER')
  update(@CurrentUser() u: JwtPayload, @Param('id') id: string, @Body() dto: UpdateProductDto) {
    return this.products.update(u.koperasiId, id, dto);
  }

  @Delete(':id')
  @Roles('PENGURUS', 'OWNER')
  remove(@CurrentUser() u: JwtPayload, @Param('id') id: string) {
    return this.products.remove(u.koperasiId, id);
  }
}
```

- [ ] **Step 5: Stock service + controller** — create/confirm DELEGATE to core (insufficient-stock guard, linked journal, atomic cascade all come free):

`stock.service.ts`:

```ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { prisma } from '@kopra/db';
import { confirmEntry, confirmMovementOnly, createMovementDraft } from '@kopra/core';
import { serializeDecimals } from '../common/http';
import { CreateStockMovementDto } from './dto/create-stock-movement.dto';

@Injectable()
export class StockService {
  async list(koperasiId: string, productId?: string) {
    const rows = await prisma.stockMovement.findMany({
      where: { koperasiId, ...(productId ? { productId } : {}) },
      orderBy: { date: 'desc' },
      include: { product: { select: { nama: true, unit: true } } },
    });
    return serializeDecimals(rows);
  }

  async create(koperasiId: string, actorId: string, dto: CreateStockMovementDto) {
    const result = await createMovementDraft(actorId, { koperasiId, ...dto }, 'WEB');
    return serializeDecimals(result); // {movementId, product, qty, stokSebelum, stokSesudah, journal?}
  }

  /** Linked journal → confirmEntry (cascades movement); tanpa jurnal → confirmMovementOnly. */
  async confirm(koperasiId: string, id: string) {
    const movement = await prisma.stockMovement.findFirst({ where: { id, koperasiId } });
    if (!movement) throw new NotFoundException('MOVEMENT_TIDAK_DITEMUKAN');
    if (movement.journalEntryId) await confirmEntry(movement.journalEntryId, koperasiId);
    else await confirmMovementOnly(id, koperasiId);
    return serializeDecimals(await prisma.stockMovement.findUnique({ where: { id } }));
  }
}
```

`stock.controller.ts`:

```ts
import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CurrentUser } from '../auth/current-user.decorator';
import type { JwtPayload } from '../auth/jwt-payload';
import { StockService } from './stock.service';
import { CreateStockMovementDto } from './dto/create-stock-movement.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('stock-movements')
export class StockController {
  constructor(private readonly stock: StockService) {}

  @Get()
  list(@CurrentUser() u: JwtPayload, @Query('productId') productId?: string) {
    return this.stock.list(u.koperasiId, productId);
  }

  @Post()
  @Roles('PENGURUS', 'OWNER')
  create(@CurrentUser() u: JwtPayload, @Body() dto: CreateStockMovementDto) {
    return this.stock.create(u.koperasiId, u.sub, dto);
  }

  @Post(':id/confirm')
  @Roles('PENGURUS', 'OWNER')
  confirm(@CurrentUser() u: JwtPayload, @Param('id') id: string) {
    return this.stock.confirm(u.koperasiId, id);
  }
}
```

`koperasi.module.ts`:

```ts
import { Module } from '@nestjs/common';
import { MembersController } from './members.controller';
import { MembersService } from './members.service';
import { UnitsController } from './units.controller';
import { ProductsController } from './products.controller';
import { ProductsService } from './products.service';
import { StockController } from './stock.controller';
import { StockService } from './stock.service';

@Module({
  controllers: [MembersController, UnitsController, ProductsController, StockController],
  providers: [MembersService, ProductsService, StockService],
})
export class KoperasiModule {}
```

Add `KoperasiModule` to `app.module.ts` imports.

- [ ] **Step 6: Live curl verification** (dev api running; `$TOKEN` from Task 2) — the demo moment "stok & kas berubah bersamaan":

```bash
PID=$(curl -s "localhost:3001/api/v1/products?search=MinyaKita" -H "authorization: Bearer $TOKEN" | node -pe 'JSON.parse(require("fs").readFileSync(0))[0].id')
S0=$(curl -s "localhost:3001/api/v1/products?search=MinyaKita" -H "authorization: Bearer $TOKEN" | node -pe 'JSON.parse(require("fs").readFileSync(0))[0].stok')
MV=$(curl -s localhost:3001/api/v1/stock-movements -H "authorization: Bearer $TOKEN" -H 'content-type: application/json' -d "{\"productId\":\"$PID\",\"type\":\"OUT\",\"qty\":5}")
MID=$(echo "$MV" | node -pe 'JSON.parse(require("fs").readFileSync(0)).movementId')
curl -s -X POST localhost:3001/api/v1/stock-movements/$MID/confirm -H "authorization: Bearer $TOKEN" >/dev/null
S1=$(curl -s "localhost:3001/api/v1/products?search=MinyaKita" -H "authorization: Bearer $TOKEN" | node -pe 'JSON.parse(require("fs").readFileSync(0))[0].stok')
echo "stok $S0 → $S1 (harus turun 5)"
# rapel simpanan
MEMID=$(curl -s "localhost:3001/api/v1/members?unpaid=true" -H "authorization: Bearer $TOKEN" | node -pe 'JSON.parse(require("fs").readFileSync(0)).data[0].id')
IDS=$(curl -s "localhost:3001/api/v1/members/$MEMID/simpanan" -H "authorization: Bearer $TOKEN" | node -pe 'JSON.parse(require("fs").readFileSync(0)).savings.filter(s=>s.status==="UNPAID").slice(0,3).map(s=>JSON.stringify(s.id)).join(",")')
curl -s "localhost:3001/api/v1/members/$MEMID/simpanan/pay" -H "authorization: Bearer $TOKEN" -H 'content-type: application/json' -d "{\"savingIds\":[$IDS]}"
# expect {"paid":3,"total":"30000","journalId":"...","nomor":"JU-0xx"} dan periode jadi PAID
# guard stok: OUT melebihi stok → 409 INSUFFICIENT_STOCK
curl -s -o /dev/null -w '%{http_code}\n' localhost:3001/api/v1/stock-movements -H "authorization: Bearer $TOKEN" -H 'content-type: application/json' -d "{\"productId\":\"$PID\",\"type\":\"OUT\",\"qty\":99999}"
```

- [ ] **Step 7: Commit** — `git add apps/api/src && git commit -m "feat(api): members+simpanan rapel, units, products (delete-guard), stock atas @kopra/core"`

---

# Task 4: Reports — core aggregation + API + dashboard

New core module (the ONLY new domain logic in Fase 1), SQL-style like dika's `stock.ts`/`savings.ts`, tested with its own fixtures on `kopra_test`.

**Files:**
- Create: `packages/core/src/reports.ts`, `packages/core/src/reports.spec.ts`
- Modify: `packages/core/src/index.ts` (add `export * from "./reports";`)
- Create: `apps/api/src/reports/reports.controller.ts`, `dashboard.controller.ts`, `html.ts`, `reports.module.ts`
- Modify: `apps/api/src/app.module.ts`

**Interfaces:**
- Produces (core, all CONFIRMED-only, scoped `koperasiId`):
  - `bukuBesar(koperasiId, opts?: {from?: Date; to?: Date}): Promise<{kode;nama;type;totalDebit;totalKredit;saldo}[]>`
  - `neracaSaldo(koperasiId, opts?): Promise<{rows: {kode;nama;debit;kredit}[]; totalDebit; totalKredit; balanced: boolean}>`
  - `phu(koperasiId, opts?: {month?: string; businessUnitId?: string}): Promise<{pendapatan; beban; labaBersih}>`
  - `neraca(koperasiId, opts?: {asOf?: Date}): Promise<{aset; kewajiban; ekuitas; labaBerjalan; balanced: boolean}>`
  - `bukuKas(koperasiId, opts?: {month?: string; kode?: string}): Promise<{rows: {tanggal;nomor;keterangan;debit;kredit;saldo}[]; saldoAkhir: number}>`
  - `dashboardSummary(koperasiId): Promise<{totalAset;totalKewajiban;totalEkuitas;pendapatan;beban;labaBersih;totalAnggota;anggotaNunggak;totalSimpananTertunggak;balanced}>`
- Produces (api): `GET /dashboard/summary` · `GET /reports/{buku-besar,neraca-saldo,phu,neraca,buku-kas}` each with `&format=html` print view.

- [ ] **Step 1: Write the failing spec** `packages/core/src/reports.spec.ts` (own fixtures; serial fork pool makes the table-wipe safe):

```ts
/** Reports — angka pasti dari fixture sendiri (kopra_test). */
import { beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@kopra/db";
import { DEFAULT_COA } from "../../db/src/coa-default";
import { bukuBesar, neracaSaldo, phu, neraca, bukuKas, dashboardSummary } from "./reports";

let kopId = "";

beforeAll(async () => {
  for (const t of [
    "pending_actions", "member_savings", "stock_movements", "journal_lines",
    "journal_entries", "products", "members", "business_units", "coa_accounts",
    "whatsapp_identities", "users", "koperasi",
  ]) await prisma.$executeRawUnsafe(`DELETE FROM ${t}`);

  const kop = await prisma.koperasi.create({
    data: { nama: "Kop Report Test", origin: "LOCAL", status: "ACTIVE", managementMode: "OWNER" },
  });
  kopId = kop.id;
  const idByKode = new Map<string, string>();
  for (const c of DEFAULT_COA) {
    const r = await prisma.coaAccount.create({
      data: { koperasiId: kopId, kode: c.kode, nama: c.nama, type: c.type,
        parentId: c.parentKode ? idByKode.get(c.parentKode) : undefined },
    });
    idByKode.set(c.kode, r.id);
  }
  const user = await prisma.user.create({
    data: { email: "r@t.id", passwordHash: "x", name: "R", role: "PENGURUS", status: "ACTIVE", koperasiId: kopId },
  });
  const member = await prisma.member.create({ data: { koperasiId: kopId, nama: "Bu Nunggak" } });
  await prisma.memberSaving.create({
    data: { memberId: member.id, type: "WAJIB", period: "2026-06", amount: 10000, status: "UNPAID" },
  });

  // 3 jurnal CONFIRMED: modal 1.000.000 · penjualan 500.000 · beban 200.000 (+1 DRAFT yg HARUS diabaikan)
  const mk = async (ket: string, dr: string, cr: string, amt: number, status: "CONFIRMED" | "DRAFT", nomor: string) =>
    prisma.journalEntry.create({
      data: {
        koperasiId: kopId, nomor, keterangan: ket, sourceChannel: "SEED", status, createdById: user.id,
        lines: { create: [
          { coaId: idByKode.get(dr)!, debit: amt, kredit: 0 },
          { coaId: idByKode.get(cr)!, debit: 0, kredit: amt },
        ] },
      },
    });
  await mk("Setoran modal", "111000", "300000", 1_000_000, "CONFIRMED", "JU-001");
  await mk("Penjualan", "111000", "410000", 500_000, "CONFIRMED", "JU-002");
  await mk("Beban listrik", "510000", "111000", 200_000, "CONFIRMED", "JU-003");
  await mk("DRAFT diabaikan", "111000", "410000", 999_999, "DRAFT", "JU-004");
});

describe("reports", () => {
  it("buku besar: kas 1.500.000 D / 200.000 K → saldo 1.300.000; DRAFT diabaikan", async () => {
    const kas = (await bukuBesar(kopId)).find((r) => r.kode === "111000")!;
    expect(kas.totalDebit).toBe(1_500_000);
    expect(kas.totalKredit).toBe(200_000);
    expect(kas.saldo).toBe(1_300_000);
  });

  it("neraca saldo seimbang", async () => {
    const ns = await neracaSaldo(kopId);
    expect(ns.totalDebit).toBe(ns.totalKredit);
    expect(ns.balanced).toBe(true);
  });

  it("PHU: 500.000 − 200.000 = 300.000", async () => {
    expect(await phu(kopId)).toEqual({ pendapatan: 500_000, beban: 200_000, labaBersih: 300_000 });
  });

  it("neraca: aset 1.300.000 = ekuitas 1.000.000 + laba 300.000", async () => {
    const n = await neraca(kopId);
    expect(n.aset).toBe(1_300_000);
    expect(n.kewajiban + n.ekuitas + n.labaBerjalan).toBe(1_300_000);
    expect(n.balanced).toBe(true);
  });

  it("buku kas: 3 baris berjalan, saldo akhir 1.300.000", async () => {
    const bk = await bukuKas(kopId);
    expect(bk.rows).toHaveLength(3);
    expect(bk.saldoAkhir).toBe(1_300_000);
  });

  it("dashboard: kartu + 1 anggota nunggak 10.000", async () => {
    const d = await dashboardSummary(kopId);
    expect(d.labaBersih).toBe(300_000);
    expect(d.totalAnggota).toBe(1);
    expect(d.anggotaNunggak).toBe(1);
    expect(d.totalSimpananTertunggak).toBe(10_000);
    expect(d.balanced).toBe(true);
  });
});
```

- [ ] **Step 2: Run to verify failure** — `pnpm --filter @kopra/core test -- reports` → FAIL (module missing).

- [ ] **Step 3: Implement** `packages/core/src/reports.ts`:

```ts
/**
 * Laporan resmi CORE — SEMUA derived dari journal_lines status CONFIRMED.
 * Konsumen: apps/api (Fase 1) & apps/agent (generateFinancialReport, refactor nanti).
 */
import { prisma } from "@kopra/db";

interface RangeOpts { from?: Date; to?: Date }

function monthRange(month?: string): RangeOpts {
  if (!month) return {};
  const [y, m] = month.split("-").map(Number);
  return { from: new Date(y, m - 1, 1), to: new Date(y, m, 1) };
}

const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

/** Saldo per akun (debit − kredit) dari jurnal CONFIRMED dalam rentang. */
async function accountTotals(koperasiId: string, opts: RangeOpts & { businessUnitId?: string } = {}) {
  return prisma.$queryRaw<
    { id: string; kode: string; nama: string; type: string; debit: number; kredit: number }[]
  >`
    SELECT c.id, c.kode, c.nama, c.type::text AS type,
      COALESCE(SUM(jl.debit) FILTER (WHERE je.id IS NOT NULL), 0)::float AS debit,
      COALESCE(SUM(jl.kredit) FILTER (WHERE je.id IS NOT NULL), 0)::float AS kredit
    FROM coa_accounts c
    LEFT JOIN journal_lines jl ON jl."coaId" = c.id
    LEFT JOIN journal_entries je ON je.id = jl."entryId"
      AND je.status = 'CONFIRMED'
      AND (${opts.from ?? null}::timestamp IS NULL OR je.date >= ${opts.from ?? null})
      AND (${opts.to ?? null}::timestamp IS NULL OR je.date < ${opts.to ?? null})
      AND (${opts.businessUnitId ?? null}::text IS NULL OR je."businessUnitId" = ${opts.businessUnitId ?? null})
    WHERE c."koperasiId" = ${koperasiId}
    GROUP BY c.id, c.kode, c.nama, c.type
    ORDER BY c.kode`;
}

export async function bukuBesar(koperasiId: string, opts: RangeOpts = {}) {
  const rows = await accountTotals(koperasiId, opts);
  return rows.map((r) => ({
    kode: r.kode, nama: r.nama, type: r.type,
    totalDebit: r2(r.debit), totalKredit: r2(r.kredit), saldo: r2(r.debit - r.kredit),
  }));
}

export async function neracaSaldo(koperasiId: string, opts: RangeOpts = {}) {
  const all = await accountTotals(koperasiId, opts);
  const rows = all
    .filter((r) => r.debit !== 0 || r.kredit !== 0)
    .map((r) => ({ kode: r.kode, nama: r.nama, debit: r2(r.debit), kredit: r2(r.kredit) }));
  const totalDebit = r2(rows.reduce((a, r) => a + r.debit, 0));
  const totalKredit = r2(rows.reduce((a, r) => a + r.kredit, 0));
  return { rows, totalDebit, totalKredit, balanced: Math.abs(totalDebit - totalKredit) < 0.005 };
}

export async function phu(koperasiId: string, opts: { month?: string; businessUnitId?: string } = {}) {
  const rows = await accountTotals(koperasiId, { ...monthRange(opts.month), businessUnitId: opts.businessUnitId });
  let pendapatan = 0, beban = 0;
  for (const r of rows) {
    if (r.type === "REVENUE") pendapatan += r.kredit - r.debit;
    if (r.type === "EXPENSE") beban += r.debit - r.kredit;
  }
  return { pendapatan: r2(pendapatan), beban: r2(beban), labaBersih: r2(pendapatan - beban) };
}

export async function neraca(koperasiId: string, opts: { asOf?: Date } = {}) {
  const rows = await accountTotals(koperasiId, { to: opts.asOf });
  let aset = 0, kewajiban = 0, ekuitas = 0, pendapatan = 0, beban = 0;
  for (const r of rows) {
    if (r.type === "ASSET") aset += r.debit - r.kredit;
    if (r.type === "LIABILITY") kewajiban += r.kredit - r.debit;
    if (r.type === "EQUITY") ekuitas += r.kredit - r.debit;
    if (r.type === "REVENUE") pendapatan += r.kredit - r.debit;
    if (r.type === "EXPENSE") beban += r.debit - r.kredit;
  }
  const labaBerjalan = r2(pendapatan - beban);
  return {
    aset: r2(aset), kewajiban: r2(kewajiban), ekuitas: r2(ekuitas), labaBerjalan,
    balanced: Math.abs(r2(aset) - r2(kewajiban + ekuitas + labaBerjalan)) < 0.005,
  };
}

/** Buku Kas = buku besar satu akun (default Kas 111000) sebagai running ledger. */
export async function bukuKas(koperasiId: string, opts: { month?: string; kode?: string } = {}) {
  const { from, to } = monthRange(opts.month);
  const kode = opts.kode ?? "111000";
  const lines = await prisma.$queryRaw<
    { tanggal: Date; nomor: string; keterangan: string; debit: number; kredit: number }[]
  >`
    SELECT je.date AS tanggal, je.nomor, je.keterangan, jl.debit::float AS debit, jl.kredit::float AS kredit
    FROM journal_lines jl
    JOIN journal_entries je ON je.id = jl."entryId" AND je.status = 'CONFIRMED'
    JOIN coa_accounts c ON c.id = jl."coaId"
    WHERE je."koperasiId" = ${koperasiId} AND c.kode = ${kode}
      AND (${from ?? null}::timestamp IS NULL OR je.date >= ${from ?? null})
      AND (${to ?? null}::timestamp IS NULL OR je.date < ${to ?? null})
    ORDER BY je.date, je.nomor`;
  let saldo = 0;
  const rows = lines.map((l) => {
    saldo = r2(saldo + l.debit - l.kredit);
    return {
      tanggal: l.tanggal.toISOString().slice(0, 10), nomor: l.nomor, keterangan: l.keterangan,
      debit: r2(l.debit), kredit: r2(l.kredit), saldo,
    };
  });
  return { rows, saldoAkhir: saldo };
}

/** Kartu dashboard ala CORE (semua SQL-derived). */
export async function dashboardSummary(koperasiId: string) {
  const [n, p, totalAnggota, nunggak] = await Promise.all([
    neraca(koperasiId),
    phu(koperasiId),
    prisma.member.count({ where: { koperasiId } }),
    prisma.$queryRaw<{ anggota: number; total: number }[]>`
      SELECT COUNT(DISTINCT m.id)::int AS anggota, COALESCE(SUM(ms.amount), 0)::float AS total
      FROM member_savings ms JOIN members m ON m.id = ms."memberId"
      WHERE m."koperasiId" = ${koperasiId} AND ms.status = 'UNPAID'`,
  ]);
  return {
    totalAset: n.aset, totalKewajiban: n.kewajiban, totalEkuitas: n.ekuitas,
    pendapatan: p.pendapatan, beban: p.beban, labaBersih: p.labaBersih,
    totalAnggota, anggotaNunggak: nunggak[0]?.anggota ?? 0,
    totalSimpananTertunggak: r2(nunggak[0]?.total ?? 0), balanced: n.balanced,
  };
}
```

Add `export * from "./reports";` to `packages/core/src/index.ts`.

- [ ] **Step 4: Run to green** — `pnpm --filter @kopra/core test` → previous 43 + 6 new all PASS. Commit: `git add packages/core/src && git commit -m "feat(core): reports buku-besar/neraca-saldo/PHU/neraca/buku-kas + dashboardSummary (TDD)"`

- [ ] **Step 5: API layer** — `apps/api/src/reports/html.ts`:

```ts
export function renderReportHtml(title: string, headers: string[], rows: (string | number)[][], footer?: string): string {
  const fmt = (v: string | number) => (typeof v === 'number' ? new Intl.NumberFormat('id-ID').format(v) : v);
  const th = headers.map((h) => `<th>${h}</th>`).join('');
  const tr = rows.map((r) => `<tr>${r.map((c) => `<td>${fmt(c)}</td>`).join('')}</tr>`).join('');
  return `<!doctype html><meta charset="utf-8"><title>${title}</title>
<style>body{font:14px/1.5 system-ui;margin:32px;color:#111}h1{font-size:18px}table{border-collapse:collapse;width:100%}th,td{border:1px solid #ccc;padding:6px 10px;text-align:left}td:not(:first-child):not(:nth-child(2)){text-align:right}@media print{button{display:none}}</style>
<h1>${title}</h1><button onclick="print()">Cetak</button>
<table><thead><tr>${th}</tr></thead><tbody>${tr}</tbody></table>${footer ? `<p><strong>${footer}</strong></p>` : ''}`;
}
```

`reports.controller.ts`:

```ts
import { Controller, Get, Query, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { bukuBesar, bukuKas, neraca, neracaSaldo, phu } from '@kopra/core';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { JwtPayload } from '../auth/jwt-payload';
import { renderReportHtml } from './html';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('reports')
export class ReportsController {
  @Get('buku-besar')
  async bukuBesar(@CurrentUser() u: JwtPayload, @Query('format') format?: string, @Res({ passthrough: true }) res?: Response) {
    const data = await bukuBesar(u.koperasiId);
    if (format === 'html' && res) {
      res.type('html');
      return renderReportHtml('Buku Besar', ['Kode', 'Akun', 'Debit', 'Kredit', 'Saldo'],
        data.map((r) => [r.kode, r.nama, r.totalDebit, r.totalKredit, r.saldo]));
    }
    return data;
  }

  @Get('neraca-saldo')
  async neracaSaldo(@CurrentUser() u: JwtPayload, @Query('format') format?: string, @Res({ passthrough: true }) res?: Response) {
    const d = await neracaSaldo(u.koperasiId);
    if (format === 'html' && res) {
      res.type('html');
      return renderReportHtml('Neraca Saldo', ['Kode', 'Akun', 'Debit', 'Kredit'],
        d.rows.map((r) => [r.kode, r.nama, r.debit, r.kredit]),
        d.balanced ? `Neraca Seimbang ✓ (D ${d.totalDebit} = K ${d.totalKredit})` : 'TIDAK SEIMBANG');
    }
    return d;
  }

  @Get('phu')
  phu(@CurrentUser() u: JwtPayload, @Query('month') month?: string, @Query('unitId') unitId?: string) {
    return phu(u.koperasiId, { month, businessUnitId: unitId });
  }

  @Get('neraca')
  neraca(@CurrentUser() u: JwtPayload, @Query('date') date?: string) {
    return neraca(u.koperasiId, { asOf: date ? new Date(date) : undefined });
  }

  @Get('buku-kas')
  async bukuKas(@CurrentUser() u: JwtPayload, @Query('month') month?: string, @Query('format') format?: string, @Res({ passthrough: true }) res?: Response) {
    const d = await bukuKas(u.koperasiId, { month });
    if (format === 'html' && res) {
      res.type('html');
      return renderReportHtml('Buku Kas (akun 111000)', ['Tanggal', 'No', 'Keterangan', 'Debit', 'Kredit', 'Saldo'],
        d.rows.map((r) => [r.tanggal, r.nomor, r.keterangan, r.debit, r.kredit, r.saldo]),
        `Saldo akhir: ${new Intl.NumberFormat('id-ID').format(d.saldoAkhir)}`);
    }
    return d;
  }
}
```

`dashboard.controller.ts`:

```ts
import { Controller, Get, UseGuards } from '@nestjs/common';
import { dashboardSummary } from '@kopra/core';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { JwtPayload } from '../auth/jwt-payload';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('dashboard')
export class DashboardController {
  @Get('summary')
  summary(@CurrentUser() u: JwtPayload) {
    return dashboardSummary(u.koperasiId);
  }
}
```

`reports.module.ts`:

```ts
import { Module } from '@nestjs/common';
import { ReportsController } from './reports.controller';
import { DashboardController } from './dashboard.controller';

@Module({ controllers: [ReportsController, DashboardController] })
export class ReportsModule {}
```

Add `ReportsModule` to `app.module.ts` imports.

- [ ] **Step 6: Live verification — neraca saldo over SEED must balance**

```bash
curl -s "localhost:3001/api/v1/reports/neraca-saldo" -H "authorization: Bearer $TOKEN" | node -pe 'const d=JSON.parse(require("fs").readFileSync(0)); `balanced=${d.balanced} D=${d.totalDebit} K=${d.totalKredit}`'
curl -s "localhost:3001/api/v1/dashboard/summary" -H "authorization: Bearer $TOKEN"
curl -s "localhost:3001/api/v1/reports/buku-kas" -H "authorization: Bearer $TOKEN" | node -pe 'JSON.parse(require("fs").readFileSync(0)).rows.length'
```

Expected: `balanced=true` with equal D/K; populated dashboard cards; buku-kas rows > 0.

- [ ] **Step 7: Commit** — `git add apps/api/src && git commit -m "feat(api): laporan CORE ×5 (+html print) & dashboard dari core.reports"`

---

# Task 5: Web — login + CORE-style dashboard screens

UI verified manually (team convention). Screens fetch the API, format with `Intl.NumberFormat("id-ID")`, and hide write actions for `ANGGOTA`.

**Files:**
- Create: `apps/web/.env.local` · `apps/web/app/lib/session.ts`, `lib/api.ts`, `lib/format.ts`
- Create: `apps/web/app/(auth)/login/page.tsx`
- Create: `apps/web/app/(dashboard)/layout.tsx`, `dashboard/page.tsx`, `coa/page.tsx`, `jurnal/page.tsx`, `produk/page.tsx`, `produk/[id]/page.tsx`, `anggota/page.tsx`, `laporan/[jenis]/page.tsx`, `pengurus/persetujuan/page.tsx`
- Modify: `apps/web/app/layout.tsx` (metadata title "Kopra"), `apps/web/app/page.tsx` (root redirect to /dashboard)

**Interfaces:** consumes every endpoint from Tasks 1–4 exactly as specified there.

- [ ] **Step 1: env + libs.** `apps/web/.env.local`:

```
NEXT_PUBLIC_API_BASE=http://localhost:3001/api/v1
```

`apps/web/app/lib/session.ts`:

```ts
'use client';
export interface Session { token: string; role: 'OWNER' | 'PENGURUS' | 'ANGGOTA'; name: string }
const KEY = 'kopra.session';
export const getSession = (): Session | null => {
  if (typeof window === 'undefined') return null;
  const v = localStorage.getItem(KEY);
  return v ? (JSON.parse(v) as Session) : null;
};
export const setSession = (s: Session) => localStorage.setItem(KEY, JSON.stringify(s));
export const clearSession = () => localStorage.removeItem(KEY);
export const canWrite = (s: Session | null) => s?.role === 'PENGURUS' || s?.role === 'OWNER';
```

`apps/web/app/lib/api.ts`:

```ts
'use client';
import { getSession, clearSession } from './session';
const BASE = process.env.NEXT_PUBLIC_API_BASE!;

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const s = getSession();
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      'content-type': 'application/json',
      ...(s ? { authorization: `Bearer ${s.token}` } : {}),
      ...(init.headers ?? {}),
    },
  });
  if (res.status === 401) {
    clearSession();
    if (typeof window !== 'undefined') window.location.href = '/login';
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({} as { message?: string }));
    throw new Error(body.message ?? `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}
```

`apps/web/app/lib/format.ts`:

```ts
export const rupiah = (v: string | number) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(Number(v));
export const num = (v: string | number) => new Intl.NumberFormat('id-ID').format(Number(v));
```

- [ ] **Step 2: Login page** `apps/web/app/(auth)/login/page.tsx`:

```tsx
'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '../../lib/api';
import { setSession } from '../../lib/session';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('pengurus@kopra.id');
  const [password, setPassword] = useState('kopra123');
  const [error, setError] = useState('');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    try {
      const r = await api<{ token: string; user: { role: 'OWNER' | 'PENGURUS' | 'ANGGOTA'; name: string } }>(
        '/auth/login',
        { method: 'POST', body: JSON.stringify({ email, password }) },
      );
      setSession({ token: r.token, role: r.user.role, name: r.user.name });
      router.push('/dashboard');
    } catch {
      setError('Email atau kata sandi salah.');
    }
  }

  return (
    <main className="min-h-screen grid place-items-center bg-slate-50">
      <form onSubmit={submit} className="w-full max-w-sm space-y-4 rounded-xl border bg-white p-8 shadow-sm">
        <div>
          <h1 className="text-xl font-semibold">Kopra</h1>
          <p className="text-sm text-slate-500">Asisten Digital Koperasi Merah Putih</p>
        </div>
        <input className="w-full rounded border px-3 py-2" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" />
        <input className="w-full rounded border px-3 py-2" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Kata sandi" />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button className="w-full rounded bg-red-600 py-2 font-medium text-white">Masuk</button>
      </form>
    </main>
  );
}
```

Also `apps/web/app/page.tsx` → replace scaffold with a redirect:

```tsx
import { redirect } from 'next/navigation';
export default function Home() { redirect('/dashboard'); }
```

And in `apps/web/app/layout.tsx` set `metadata` title/description to `Kopra` / `Asisten Digital Koperasi Merah Putih` (leave fonts/classNames as scaffolded).

- [ ] **Step 3: Dashboard layout (sidebar ala CORE + role gate)** `apps/web/app/(dashboard)/layout.tsx`:

```tsx
'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { getSession, clearSession, type Session } from '../lib/session';

const NAV = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/coa', label: 'Akuntansi › COA' },
  { href: '/jurnal', label: 'Akuntansi › Jurnal' },
  { href: '/produk', label: 'Produk & Stok' },
  { href: '/anggota', label: 'Anggota & Simpanan' },
  { href: '/laporan/buku-besar', label: 'Laporan' },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [session, setSessionState] = useState<Session | null>(null);
  useEffect(() => {
    const s = getSession();
    if (!s) router.replace('/login');
    else setSessionState(s);
  }, [router]);
  if (!session) return null;
  return (
    <div className="flex min-h-screen">
      <aside className="flex w-60 shrink-0 flex-col border-r bg-slate-900 text-slate-100">
        <div className="p-4 text-lg font-semibold">Kopra</div>
        <nav className="flex flex-col gap-1 px-2">
          {NAV.map((n) => {
            const seg = `/${n.href.split('/')[1]}`;
            const active = pathname.startsWith(seg);
            return (
              <Link key={n.href} href={n.href} className={`rounded px-3 py-2 text-sm ${active ? 'bg-slate-700' : 'hover:bg-slate-800'}`}>
                {n.label}
              </Link>
            );
          })}
        </nav>
        <div className="mt-auto p-4 text-xs text-slate-400">
          <div>{session.name} · {session.role}</div>
          <button className="mt-2 underline" onClick={() => { clearSession(); router.replace('/login'); }}>Keluar</button>
        </div>
      </aside>
      <main className="flex-1 bg-slate-50 p-8">{children}</main>
    </div>
  );
}
```

- [ ] **Step 4: Dashboard cards** `apps/web/app/(dashboard)/dashboard/page.tsx` (numbers from `/dashboard/summary` — core returns them as JSON numbers here, format client-side):

```tsx
'use client';
import { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { rupiah } from '../../lib/format';

interface Summary {
  totalAset: number; totalKewajiban: number; totalEkuitas: number;
  pendapatan: number; beban: number; labaBersih: number;
  totalAnggota: number; anggotaNunggak: number; totalSimpananTertunggak: number; balanced: boolean;
}

export default function DashboardPage() {
  const [s, setS] = useState<Summary | null>(null);
  useEffect(() => { api<Summary>('/dashboard/summary').then(setS).catch(() => {}); }, []);
  if (!s) return <p>Memuat…</p>;
  const cards: [string, string][] = [
    ['Total Aset', rupiah(s.totalAset)], ['Kewajiban', rupiah(s.totalKewajiban)], ['Ekuitas', rupiah(s.totalEkuitas)],
    ['Pendapatan', rupiah(s.pendapatan)], ['Beban', rupiah(s.beban)], ['Laba Bersih', rupiah(s.labaBersih)],
    ['Total Anggota', String(s.totalAnggota)], ['Anggota Nunggak', String(s.anggotaNunggak)], ['Simpanan Tertunggak', rupiah(s.totalSimpananTertunggak)],
  ];
  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold">Dashboard</h1>
      <div className="grid grid-cols-3 gap-4">
        {cards.map(([label, value]) => (
          <div key={label} className="rounded-xl border bg-white p-5">
            <div className="text-sm text-slate-500">{label}</div>
            <div className="mt-1 text-xl font-semibold">{value}</div>
          </div>
        ))}
      </div>
      <p className="mt-4 text-sm text-slate-500">Neraca: {s.balanced ? 'Seimbang ✓' : 'TIDAK SEIMBANG'}</p>
    </div>
  );
}
```

- [ ] **Step 5: Jurnal page (list + confirm + badge WA + polling 5s)** `apps/web/app/(dashboard)/jurnal/page.tsx`:

```tsx
'use client';
import { useCallback, useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { getSession, canWrite } from '../../lib/session';
import { rupiah } from '../../lib/format';

interface Line { debit: string; kredit: string; coa: { kode: string; nama: string } }
interface Entry {
  id: string; nomor: string; date: string; keterangan: string;
  status: 'DRAFT' | 'CONFIRMED'; sourceChannel: string; lines: Line[];
  businessUnit: { nama: string } | null;
}

export default function JurnalPage() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const writable = canWrite(getSession());
  const load = useCallback(() => {
    api<{ data: Entry[] }>('/journals?pageSize=50').then((r) => setEntries(r.data)).catch(() => {});
  }, []);
  useEffect(() => {
    load();
    const t = setInterval(load, 5000); // jurnal dari WA muncul ≤5 dtk
    return () => clearInterval(t);
  }, [load]);

  async function confirm(id: string) {
    await api(`/journals/${id}/confirm`, { method: 'POST' });
    load();
  }

  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold">Jurnal</h1>
      <table className="w-full border-collapse bg-white text-sm">
        <thead>
          <tr className="border-b text-left text-slate-500">
            {['No. Jurnal', 'Tanggal', 'Keterangan', 'Unit', 'Nominal', 'Status', ''].map((h) => <th key={h} className="p-2">{h}</th>)}
          </tr>
        </thead>
        <tbody>
          {entries.map((e) => {
            const total = e.lines.reduce((a, l) => a + Number(l.debit), 0);
            return (
              <tr key={e.id} className="border-b align-top">
                <td className="p-2 font-mono">
                  {e.nomor}
                  {e.sourceChannel === 'WHATSAPP' && <span className="ml-1 rounded bg-green-100 px-1 text-xs text-green-700">WA</span>}
                </td>
                <td className="p-2">{e.date.slice(0, 10)}</td>
                <td className="p-2">
                  {e.keterangan}
                  <div className="text-xs text-slate-400">{e.lines.map((l) => `${l.coa.kode} ${l.coa.nama}`).join(' · ')}</div>
                </td>
                <td className="p-2">{e.businessUnit?.nama ?? '-'}</td>
                <td className="p-2 text-right">{rupiah(total)}</td>
                <td className="p-2">
                  {e.status === 'CONFIRMED'
                    ? <span className="text-green-700">CONFIRMED</span>
                    : <span className="text-amber-600">DRAFT</span>}
                </td>
                <td className="p-2">
                  {writable && e.status === 'DRAFT' && (
                    <button onClick={() => confirm(e.id)} className="rounded bg-red-600 px-2 py-1 text-xs text-white">Konfirmasi</button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 6: COA tree** `apps/web/app/(dashboard)/coa/page.tsx`:

```tsx
'use client';
import { useEffect, useState } from 'react';
import { api } from '../../lib/api';

interface Node { id: string; kode: string; nama: string; type: string; children: Node[] }

function Row({ n, depth }: { n: Node; depth: number }) {
  return (
    <>
      <tr className="border-b">
        <td className="p-2 font-mono" style={{ paddingLeft: 8 + depth * 20 }}>{n.kode}</td>
        <td className="p-2">{n.nama}</td>
        <td className="p-2 text-xs text-slate-500">{n.type}</td>
      </tr>
      {n.children?.map((c) => <Row key={c.id} n={c} depth={depth + 1} />)}
    </>
  );
}

export default function CoaPage() {
  const [tree, setTree] = useState<Node[]>([]);
  useEffect(() => { api<Node[]>('/coa?tree=true').then(setTree).catch(() => {}); }, []);
  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold">Bagan Akun (COA)</h1>
      <table className="w-full border-collapse bg-white text-sm">
        <thead>
          <tr className="border-b text-left text-slate-500"><th className="p-2">Kode</th><th className="p-2">Nama Akun</th><th className="p-2">Tipe</th></tr>
        </thead>
        <tbody>{tree.map((n) => <Row key={n.id} n={n} depth={0} />)}</tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 7: Produk list + kartu stok**

`apps/web/app/(dashboard)/produk/page.tsx`:

```tsx
'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '../../lib/api';
import { rupiah, num } from '../../lib/format';

interface Product { id: string; nama: string; unit: string | null; hargaJual: string | null; stok: number; isActive: boolean }

export default function ProdukPage() {
  const [rows, setRows] = useState<Product[]>([]);
  useEffect(() => { api<Product[]>('/products').then(setRows).catch(() => {}); }, []);
  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold">Produk & Stok</h1>
      <table className="w-full border-collapse bg-white text-sm">
        <thead>
          <tr className="border-b text-left text-slate-500">
            <th className="p-2">Produk</th><th className="p-2">Satuan</th>
            <th className="p-2 text-right">Harga Jual</th><th className="p-2 text-right">Stok</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((p) => (
            <tr key={p.id} className={`border-b ${p.isActive ? '' : 'opacity-40'}`}>
              <td className="p-2"><Link className="text-red-700 underline" href={`/produk/${p.id}`}>{p.nama}</Link></td>
              <td className="p-2">{p.unit ?? '-'}</td>
              <td className="p-2 text-right">{p.hargaJual ? rupiah(p.hargaJual) : '-'}</td>
              <td className={`p-2 text-right ${p.stok <= 5 ? 'font-semibold text-red-600' : ''}`}>{num(p.stok)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

`apps/web/app/(dashboard)/produk/[id]/page.tsx`:

```tsx
'use client';
import { use, useEffect, useState } from 'react';
import { api } from '../../../lib/api';
import { num } from '../../../lib/format';

interface Movement { id: string; type: string; qty: string; date: string; status: string }
interface Card { product: { nama: string; unit: string | null }; stok: number; movements: Movement[] }

export default function ProdukCardPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [card, setCard] = useState<Card | null>(null);
  useEffect(() => { api<Card>(`/products/${id}/card`).then(setCard).catch(() => {}); }, [id]);
  if (!card) return <p>Memuat…</p>;
  return (
    <div>
      <h1 className="mb-2 text-2xl font-semibold">{card.product.nama}</h1>
      <p className="mb-6 text-slate-500">Stok terkini: <strong>{num(card.stok)}</strong> {card.product.unit}</p>
      <table className="w-full border-collapse bg-white text-sm">
        <thead>
          <tr className="border-b text-left text-slate-500">
            <th className="p-2">Tanggal</th><th className="p-2">Jenis</th>
            <th className="p-2 text-right">Qty</th><th className="p-2">Status</th>
          </tr>
        </thead>
        <tbody>
          {card.movements.map((m) => (
            <tr key={m.id} className="border-b">
              <td className="p-2">{m.date.slice(0, 10)}</td><td className="p-2">{m.type}</td>
              <td className="p-2 text-right">{num(m.qty)}</td><td className="p-2">{m.status}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 8: Anggota + simpanan (bayar rapel)** `apps/web/app/(dashboard)/anggota/page.tsx`:

```tsx
'use client';
import { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { getSession, canWrite } from '../../lib/session';
import { rupiah } from '../../lib/format';

interface Member { id: string; nama: string; unpaidCount: number }
interface Saving { id: string; type: string; period: string; amount: string; status: 'PAID' | 'UNPAID' }

export default function AnggotaPage() {
  const writable = canWrite(getSession());
  const [members, setMembers] = useState<Member[]>([]);
  const [sel, setSel] = useState<string | null>(null);
  const [savings, setSavings] = useState<Saving[]>([]);
  const [checked, setChecked] = useState<Set<string>>(new Set());

  const loadMembers = () => api<{ data: Member[] }>('/members').then((r) => setMembers(r.data));
  useEffect(() => { loadMembers().catch(() => {}); }, []);

  async function open(id: string) {
    setSel(id);
    setChecked(new Set());
    const r = await api<{ savings: Saving[] }>(`/members/${id}/simpanan`);
    setSavings(r.savings);
  }

  async function pay() {
    if (!sel || checked.size === 0) return;
    await api(`/members/${sel}/simpanan/pay`, { method: 'POST', body: JSON.stringify({ savingIds: [...checked] }) });
    await open(sel);
    await loadMembers();
  }

  return (
    <div className="grid grid-cols-2 gap-6">
      <div>
        <h1 className="mb-4 text-2xl font-semibold">Anggota</h1>
        <table className="w-full border-collapse bg-white text-sm">
          <thead>
            <tr className="border-b text-left text-slate-500"><th className="p-2">Nama</th><th className="p-2 text-right">Nunggak</th></tr>
          </thead>
          <tbody>
            {members.map((m) => (
              <tr key={m.id} className={`cursor-pointer border-b ${sel === m.id ? 'bg-red-50' : ''}`} onClick={() => open(m.id)}>
                <td className="p-2">{m.nama}</td><td className="p-2 text-right">{m.unpaidCount}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div>
        {sel && (
          <>
            <h2 className="mb-4 text-xl font-semibold">Simpanan</h2>
            <table className="w-full border-collapse bg-white text-sm">
              <thead>
                <tr className="border-b text-left text-slate-500">
                  <th className="p-2"></th><th className="p-2">Jenis</th><th className="p-2">Periode</th>
                  <th className="p-2 text-right">Jumlah</th><th className="p-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {savings.map((s) => (
                  <tr key={s.id} className="border-b">
                    <td className="p-2">
                      {writable && s.status === 'UNPAID' && (
                        <input type="checkbox" checked={checked.has(s.id)}
                          onChange={(e) => {
                            const n = new Set(checked);
                            if (e.target.checked) n.add(s.id); else n.delete(s.id);
                            setChecked(n);
                          }} />
                      )}
                    </td>
                    <td className="p-2">{s.type}</td><td className="p-2">{s.period}</td>
                    <td className="p-2 text-right">{rupiah(s.amount)}</td>
                    <td className="p-2">{s.status === 'PAID' ? <span className="text-green-700">PAID</span> : <span className="text-amber-600">UNPAID</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {writable && checked.size > 0 && (
              <button onClick={pay} className="mt-4 rounded bg-red-600 px-4 py-2 text-white">Bayar Rapel ({checked.size} periode)</button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 9: Laporan tabs + persetujuan stub**

`apps/web/app/(dashboard)/laporan/[jenis]/page.tsx`:

```tsx
'use client';
import { use, useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '../../../lib/api';

const BASE = process.env.NEXT_PUBLIC_API_BASE!;
const TABS = [
  ['buku-besar', 'Buku Besar'], ['neraca-saldo', 'Neraca Saldo'],
  ['phu', 'PHU'], ['neraca', 'Neraca'], ['buku-kas', 'Buku Kas'],
] as const;

export default function LaporanPage({ params }: { params: Promise<{ jenis: string }> }) {
  const { jenis } = use(params);
  const [data, setData] = useState<unknown>(null);
  useEffect(() => { api(`/reports/${jenis}`).then(setData).catch(() => setData({ error: true })); }, [jenis]);
  return (
    <div>
      <div className="mb-6 flex gap-2">
        {TABS.map(([slug, label]) => (
          <Link key={slug} href={`/laporan/${slug}`}
            className={`rounded px-3 py-1 text-sm ${jenis === slug ? 'bg-red-600 text-white' : 'border bg-white'}`}>
            {label}
          </Link>
        ))}
      </div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">{TABS.find((t) => t[0] === jenis)?.[1]}</h1>
        <a className="text-sm underline" href={`${BASE}/reports/${jenis}?format=html`} target="_blank">Versi cetak (siap RAT)</a>
      </div>
      <pre className="overflow-auto rounded bg-white p-4 text-xs">{JSON.stringify(data, null, 2)}</pre>
      <p className="mt-2 text-xs text-slate-400">Tabel print-ready ada di “Versi cetak”. (Tabel styled per laporan = polish Fase 5.)</p>
    </div>
  );
}
```

Note: the print link opens without the Authorization header — for the demo either paste the URL with a token query later (Fase 5 polish) or use it right after login in the same browser via an api-side allowance. Acceptable Fase-1 behavior: JSON view in-app is authoritative; "Versi cetak" is demoed via curl-saved HTML if needed.

`apps/web/app/(dashboard)/pengurus/persetujuan/page.tsx` (route exists; approval logic = Fase 3):

```tsx
'use client';
export default function PersetujuanPage() {
  return (
    <div>
      <h1 className="mb-4 text-2xl font-semibold">Persetujuan Pengurus</h1>
      <p className="text-slate-500">Alur persetujuan registrasi anggota (OWNER) hadir di Fase 3.</p>
    </div>
  );
}
```

- [ ] **Step 10: Manual verification checklist** (`pnpm dev:api` + `pnpm dev:web`):

1. `/login` → `pengurus@kopra.id`/`kopra123` → `/dashboard`: 9 cards, "Neraca: Seimbang ✓".
2. `/jurnal`: 24+ seed journals; create a DRAFT via curl (Task 2 Step 8) → shows **Konfirmasi** → click → CONFIRMED within one 5s poll.
3. `/coa`: tree AKTIVA→Kas/Bank/Piutang/Persediaan etc.
4. `/produk`: 10 products with stok; ≤5 red; click → kartu stok history.
5. `/anggota`: pick member with nunggak → check periods → **Bayar Rapel** → PAID + nunggak count drops; `/jurnal` shows the new SAVING_PAYMENT entry.
6. `/laporan/neraca-saldo`: `balanced: true`.
7. Logout → login `anggota@kopra.id`: all pages readable, **zero** write buttons (no Konfirmasi, no checkboxes, no Bayar Rapel).

- [ ] **Step 11: Commit** — `git add apps/web && git commit -m "feat(web): login + dashboard CORE-style (jurnal confirm+poll, coa tree, produk+kartu, anggota rapel, laporan)"`

---

## Self-Review

**Spec coverage** (unified plan Fase 1 = tasks 1.1–1.5): 1.1 auth → Task 1 ✓ · 1.2 accounting (posting rules already in core M1; HTTP `/coa`, `/journals`, `/journals/simple`, `/journals/:id/confirm` + immutability) → Task 2 ✓ · 1.3 members+savings rapel→jurnal, units, products delete-guard, stock derived + STOCK_SALE auto-journal → Task 3 ✓ (auto-journal + insufficient-stock live in core `createMovementDraft`) · 1.4 `/dashboard/summary` + 5 reports `?format=html`, neraca saldo balanced over seed → Task 4 ✓ · 1.5 web screens + MEMBER read-only + WA badge + 5s poll + `/pengurus/persetujuan` → Task 5 ✓. Environment gap (no .env/DB/rag_fts.sql/global-setup Windows-only) → Task 0 ✓.

**Type consistency:** DTO fields mirror core signatures (`description`, `coaKode`, `via`); `PaySavingsDto.savingIds` mapped to core `periods+amount` inside `MembersService.pay`; stock confirm branches on `journalEntryId` matching core's `confirmEntry` cascade vs `confirmMovementOnly` guard (which rejects linked movements). `JwtPayload` fields consistent across guards/controllers. Report return shapes consistent between core, controllers, and web pages (dashboard numbers as JSON numbers; Prisma Decimal strings elsewhere via `serializeDecimals`).

**Honest scope stubs (not placeholders):** persetujuan page (Fase 3 logic), laporan JSON view + print-HTML (styled tables = Fase 5 polish, print-link auth noted).

**Execution risks:** (1) raw SQL in `reports.ts` uses `NULL::timestamp` comparison pattern — if Prisma's parameter typing complains, split queries by presence of filters; the spec catches this immediately. (2) jest-e2e now loads AppModule incl. WhatsappModule — `WA_OUTBOX_DISABLED=1` in setup-env keeps the outbox worker off in tests. (3) `stockLevels` only returns active products — `ProductsService.list` fills missing ids with `stok: 0` (inactive products), which is correct display behavior.

## Execution Handoff

Plan complete (v2). Execution: **superpowers:subagent-driven-development** — one fresh subagent per task (0→5), review between tasks. Task order is strict (each consumes the previous task's interfaces).
