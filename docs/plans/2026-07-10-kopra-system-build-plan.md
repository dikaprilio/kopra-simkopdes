# Kopra — System Build Plan (Phased)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Membangun keseluruhan sistem Kopra untuk sprint 36 jam: web ERP stand-in (Financing+Inventory ala suite resmi), WhatsApp bot dengan CRUD ERP (DM pengurus), registrasi dual-flow (WA↔web+OTP), dan group support read-only — demo end-to-end di VPS.

**Architecture:** Monorepo pnpm: `apps/web` (Next.js, layar), `apps/api` (NestJS, guardrail+CRUD+webhook), `apps/agent` (Mastra, otak+workflow suspend/resume+RAG), `packages/db` (Prisma, 18 model). Gateway WA = GoWA (repo `kopra-whatsapp-waha`) di balik interface `WhatsappGateway`. Semua angka dari SQL (posting rules deterministik); LLM hanya intent+narasi.

**Tech Stack:** Next.js (App Router) · NestJS · Mastra (agent/workflow/memory/RAG) · Prisma + Postgres pgvector (docker :5433) · GoWA · Claude `claude-opus-4-8` · Whisper Groq (stretch).

## Global Constraints

- Bahasa UI & bot: Indonesia sederhana; istilah keuangan mengikuti CORE resmi (COA, Jurnal, Buku Besar, Neraca Saldo, PHU, Neraca).
- **LLM explains, backend calculates**: commit data hanya lewat kode setelah "YA"; angka selalu hasil query.
- Semua query/mutasi scoped `koperasiId`; semua tool-call & mutasi → `audit_logs`.
- `journal_entries`/`stock_movements` CONFIRMED = immutable (koreksi = jurnal balik).
- Kredensial & PII: tidak pernah masuk repo (repo publik saat submission). NIK hanya via form web (bukan chat WA).
- Ports: web 3000 · api 3001 · gowa 3002 · agent 4111 · postgres app 5433 (mirror panitia lokal dev = 5432).
- Env baru (tambah ke `.env.example` di Task 0.2): `APP_PUBLIC_WEB_URL` (basis magic-link/OTP page), `OTP_TTL_SECONDS=300`, `MAGIC_LINK_TTL_SECONDS=900`.
- Commit kecil & sering ke `main`, TANPA `Co-Authored-By`. Format: `feat(api): …`, `feat(agent): …`, `feat(web): …`, `chore(db): …`.
- Testing pragmatis hackathon: **unit test WAJIB untuk logika uang & keputusan** (posting rules, balance validator, state machine, group resolution, NIK matching, RBAC gate) pakai Vitest/Jest bawaan scaffold; fitur lain diverifikasi lewat perintah `curl`/playground yang tercantum di tiap task. Jangan tulis test UI.

## Matriks akses (LOCKED — hasil keputusan 10 Jul malam)

| Konteks | Guest (nomor tak dikenal) | ANGGOTA | PENGURUS |
|---|---|---|---|
| DM | RAG umum + flow registrasi | RAG umum + status registrasinya | SEMUA: 7 tools + CRUD + laporan |
| Grup ter-attach | RAG + read ringan (stok, produk, info koperasi) — **tanpa** ringkasan keuangan/penunggak, **tanpa** C/U/D (diarahkan DM) | sama | sama (mutasi tetap diarahkan ke DM) |
| Web | landing saja | login: lihat profil & simpanan sendiri (opsional, stretch) | full ERP |

Bot di grup hanya membalas saat di-mention. Grup tanpa koperasi ter-attach: bot hanya menjawab pertanyaan resolusi koperasi.

---

# FASE 0 — Fondasi (repo → stack hidup) · target jam 0–3

### Task 0.1: Scaffold 3 aplikasi

**Files:** Create: `apps/web/*` (create-next-app) · `apps/api/*` (nest new) · `apps/agent/*` (create mastra) — ikuti README masing-masing folder (perintah persis sudah ada di sana).

- [ ] **Step 1:** Dari root: `pnpm create next-app@latest apps/web --ts --app --tailwind --eslint --import-alias "@/*" --use-pnpm` → set `"name":"web"`.
- [ ] **Step 2:** `pnpm dlx @nestjs/cli new api --directory apps/api --package-manager pnpm --skip-git` → set `"name":"api"`, port dari `API_PORT` di `apps/api/src/main.ts`: `await app.listen(process.env.API_PORT ?? 3001)`.
- [ ] **Step 3:** `pnpm create mastra@latest apps/agent` (pilih agents+tools+workflows, provider Anthropic) → set `"name":"agent"`; `npx skills add mastra-ai/skills`.
- [ ] **Step 4:** `pnpm install` di root sukses; `pnpm dev:api`, `pnpm dev:web`, `pnpm dev:agent` masing-masing hidup (cek `curl -s localhost:3001 | head -1`, buka :3000, buka :4111).
- [ ] **Step 5:** Commit `chore: scaffold web(next), api(nest), agent(mastra)`.

### Task 0.2: Schema delta registrasi+grup, db push, client singleton

**Files:** Modify: `packages/db/prisma/schema.prisma` · Create: `packages/db/src/index.ts` · Modify: `.env.example`
**Interfaces (Produces):** `import { prisma } from "@kopra/db"` dipakai api & agent. Model baru: `AuthToken`, `WaGroup`, `KoperasiDirectory`; `User` bertambah `nik?`, `status`, `koperasiId?`, `memberId?`; `Member` bertambah `nik?`.

- [ ] **Step 1:** Tambahkan ke schema (lengkap, tempel):

```prisma
enum UserStatus {
  ACTIVE
  PENDING_OTP        // web-register, belum verifikasi nomor WA
  PENDING_APPROVAL   // NIK tak match — menunggu pengurus
}

enum TokenType {
  MAGIC_LINK  // WA-register → link form web
  OTP         // web-register → kode 6 digit via DM bot
}

enum WaGroupStatus {
  PENDING   // belum ter-attach koperasi
  ATTACHED
}

model AuthToken {
  id          String    @id @default(cuid())
  type        TokenType
  tokenHash   String    @unique // sha256(token); token mentah hanya dikirim ke user
  waNumber    String
  payloadJson Json      // {role, koperasiId?, koperasiDirectoryRef?, nama?}
  expiresAt   DateTime
  usedAt      DateTime?
  createdAt   DateTime  @default(now())

  @@index([waNumber, type])
  @@map("auth_tokens")
}

model WaGroup {
  id               String        @id @default(cuid())
  groupJid         String        @unique // "1203...@g.us"
  nama             String?
  status           WaGroupStatus @default(PENDING)
  koperasiId       String?
  attachedByUserId String?
  createdAt        DateTime      @default(now())

  koperasi Koperasi? @relation(fields: [koperasiId], references: [id])

  @@map("wa_groups")
}

// Direktori 1.026 koperasi resmi (nama publik, PII-free) — sumber pencarian
// saat registrasi & auto-onboard. Di-seed dari packages/db/seed-data/koperasi-directory.json
model KoperasiDirectory {
  sourceRef String  @id // "KOP-539EF09CDAAD"
  nama      String
  wilayah   String?

  @@map("koperasi_directory")
}
```

- [ ] **Step 2:** Update `model User`: tambah `nik String? @unique`, `status UserStatus @default(ACTIVE)`, `koperasiId String?`, `memberId String? @unique`, relasi `koperasi Koperasi? @relation(fields:[koperasiId], references:[id])`, `member Member? @relation(fields:[memberId], references:[id])` (+back-relations di `Koperasi.users`, `Member.user`, `Koperasi.waGroups`). Update `model Member`: tambah `nik String?` + `@@index([koperasiId, nik])`.
- [ ] **Step 3:** `packages/db/src/index.ts`:

```ts
import { PrismaClient } from "@prisma/client";
export * from "@prisma/client";
const g = globalThis as unknown as { prisma?: PrismaClient };
export const prisma = g.prisma ?? new PrismaClient();
if (process.env.NODE_ENV !== "production") g.prisma = prisma;
```

- [ ] **Step 4:** `docker compose up -d postgres` → `pnpm --filter @kopra/db generate && pnpm db:push` → Expected: `Your database is now in sync`.
- [ ] **Step 5:** Commit `chore(db): schema registrasi (AuthToken, WaGroup, KoperasiDirectory) + client singleton`.

### Task 0.3: Seed & import

**Files:** Create: `packages/db/src/seed.ts`, `packages/db/src/import-koperasi.ts`, `packages/db/src/coa-default.ts`, `packages/db/seed-data/koperasi-directory.json` (digenerate sekali dari mirror), `packages/db/src/gen-directory.ts`
**Interfaces (Produces):** user demo `pengurus@kopra.id`/`kopra123` (PENGURUS, NIK `3402000000000001`, WA = nomor tes tim) & `anggota@kopra.id`/`kopra123`; koperasi demo `KDMP Palbapang (Demo)` berisi COA default, 6 unit usaha, ~60 jurnal 2 bulan (kosakata asli dari `docs/riset-lapangan/berkas-lapangan-anonim.md`), 10 produk sembako, simpanan 15 member (campuran PAID/UNPAID, beberapa NIK terisi utk demo NIK-match).

- [ ] **Step 1:** `coa-default.ts` — export konstanta `DEFAULT_COA: {kode, nama, type, parentKode?}[]` sesuai spec §2 (100000 AKTIVA → 111000 Kas Rupiah, 112100 Bank BRI, 113000 Piutang, 114000 Persediaan; 200000 KEWAJIBAN; 300000 EKUITAS → 310000 Simpanan Pokok, 320000 Simpanan Wajib; 400000 PENDAPATAN → anak per unit (41x000); 500000 BEBAN → 510000 Beban Operasional, 520000 Beban Adm Bank).
- [ ] **Step 2:** `gen-directory.ts` — baca `SOURCE_DATABASE_URL` → `SELECT koperasi_ref, nama_koperasi FROM profil_koperasi` (+wilayah via join referensi) → tulis `seed-data/koperasi-directory.json`. Jalankan sekali di laptop Dika; file JSON DI-COMMIT (nama koperasi = data publik).
- [ ] **Step 3:** `seed.ts` — idempotent (upsert by kode/nama): koperasi demo + COA + unit + user + member+savings + produk + jurnal via `postJournal()` util sederhana lokal seed (Dr/Cr eksplisit). Termasuk `koperasi_directory` dari JSON.
- [ ] **Step 4:** `import-koperasi.ts` — arg `--ref KOP-XXXX`: tarik profil+anggota (nama, nik [masked ok], status simpanan per periode)+pengurus+produk dari mirror → upsert ke tabel Kopra (`sourceRef` keys). Tanpa mirror (VPS): exit dengan pesan "mirror tidak tersedia — pakai auto-onboard directory".
- [ ] **Step 5:** `pnpm db:seed` sukses; verifikasi: `SELECT COUNT(*) FROM koperasi_directory` = 1026, jurnal ≈ 60. Commit `feat(db): seed demo + koperasi directory + import script`.

### Task 0.4: Gateway GoWA hidup (repo infra)

**Files:** repo `kopra-whatsapp-waha` (sudah berisi compose GoWA — lihat README-nya).

- [ ] **Step 1:** `.env` isi `GOWA_BASIC_AUTH`, `WA_WEBHOOK_SECRET`, `WEBHOOK_URL=http://host.docker.internal:3001/wa/webhook` → `docker compose up -d`.
- [ ] **Step 2:** Buka `localhost:3002` → Login QR pakai **nomor burner**. Kirim "halo" dari HP lain → cek `docker logs kopra-gowa` menunjukkan POST webhook (akan 404 sampai Fase 2 — itu OK).
- [ ] **Step 3 (spike wajib, hasil ditulis di `docs/plans/notes-gowa.md`):** verifikasi payload: (a) field pesan grup (`from` berakhiran `@g.us`?), (b) format mention di payload, (c) endpoint list participant grup, (d) endpoint download media. Uji: `curl -u $GOWA_BASIC_AUTH localhost:3002/app/devices`.

---

# FASE 1 — ERP Web stand-in (Financing + Inventory) · target jam 3–10

> Framing (untuk README & pitch): web ini = **MVP stand-in dari sistem existing** (CORE Finance + Warehouse yang kita tak punya aksesnya, flow dari video tutorial) — pembuktian bahwa bot bisa menempel ke sistem yang sudah ada. Menu & istilah meniru CORE.

### Task 1.1: api: auth + guard scoping

**Files:** Create: `apps/api/src/auth/{auth.module,auth.service,auth.controller,jwt.strategy,jwt.guard,roles.guard}.ts`
**Interfaces (Produces):** `POST /auth/login {email,password} → {token}` (JWT payload `{sub, koperasiId, role, status}`); decorator `@Roles('PENGURUS')`; `req.user = {userId, koperasiId, role}`. User `status !== 'ACTIVE'` ditolak login (403 `AKUN_PENDING`).

- [ ] Implement (bcrypt compare, `@nestjs/jwt`); test service: login pengurus seed → token berisi koperasiId; login user PENDING → 403. Verif: `curl -s -X POST localhost:3001/auth/login -H 'content-type: application/json' -d '{"email":"pengurus@kopra.id","password":"kopra123"}'` → token. Commit `feat(api): auth jwt + role guard`.

### Task 1.2: api: accounting core (COA, jurnal, posting rules) — JANTUNG SISTEM, TDD penuh

**Files:** Create: `apps/api/src/accounting/{accounting.module,coa.service,coa.controller,journal.service,journal.controller,posting-rules.ts,journal.spec.ts,posting-rules.spec.ts}`
**Interfaces (Produces — dipakai agent Fase 2 & reports 1.4):**

```ts
// posting-rules.ts
export type SimpleEntryInput = {
  koperasiId: string; kind: "INCOME"|"EXPENSE"|"STOCK_PURCHASE"|"STOCK_SALE"|"SAVING_PAYMENT";
  amount: number; description: string; date?: Date;
  businessUnitId?: string; via?: "KAS"|"BANK";
  meta?: { productId?: string; qty?: number; memberId?: string; periods?: string[]; savingType?: "POKOK"|"WAJIB" };
};
export function buildLines(input: SimpleEntryInput, coaMap: CoaMap): {coaKode: string; debit: number; kredit: number}[];

// journal.service.ts
createDraft(userId: string, input: SimpleEntryInput): Promise<JournalEntry>   // nomor JU-xxx auto
createManual(userId: string, header, lines): Promise<JournalEntry>            // validasi balance
confirm(userId: string, entryId: string): Promise<JournalEntry>               // DRAFT→CONFIRMED (+movement linked, atomik $transaction)
reject(userId: string, entryId: string): Promise<void>                        // hapus DRAFT (cascade lines)
```

- [ ] **Step 1 (test dulu):** `posting-rules.spec.ts` — kasus per tabel spec §2: INCOME banyu 500000 → Dr 111000/Cr 412000(BANEW) · EXPENSE → Dr 510000/Cr 111000 · STOCK_PURCHASE 20×14000 → Dr 114000 280000/Cr 111000 · STOCK_SALE 5×15500 → Dr 111000/Cr 41x · SAVING_PAYMENT wajib 3 periode 150000 → Dr 111000/Cr 320000; assert `SUM debit == SUM kredit` di semua kasus. Jalankan → FAIL.
- [ ] **Step 2:** Implement `buildLines` + `journal.service` (nomor: `JU-${String(count+1).padStart(3,"0")}` per koperasi, dalam transaction). `confirm`: kalau entry punya `stockMovement` → confirm keduanya dalam satu `$transaction`. Test PASS.
- [ ] **Step 3:** Controllers: `GET /coa?tree=true`, `POST /coa`, `GET /journals?month=&status=&unitId=`, `POST /journals/simple` (body `SimpleEntryInput`), `POST /journals` (manual), `PATCH /journals/:id` (DRAFT only), `POST /journals/:id/confirm`, `DELETE /journals/:id` (DRAFT only). Verif curl: simple income → confirm → `GET /journals` status CONFIRMED.
- [ ] Commit `feat(api): accounting core — coa, jurnal, posting rules (TDD)`.

### Task 1.3: api: master data + inventory + simpanan

**Files:** Create: `apps/api/src/koperasi/{koperasi.module,members.controller+service,units.controller,products.controller+service,stock.controller+service,savings.service}.ts`, `apps/api/src/koperasi/stock.spec.ts`
**Interfaces (Produces):** endpoint sesuai spec §4; `stock.service.currentStock(productId): Promise<number>` = SUM CONFIRMED (IN + / OUT −, ADJUST ±); `savings.service.pay(memberId, periods[], amount, userId)` → jurnal SAVING_PAYMENT draft+confirm + set periods PAID (atomik); `stock.service.createMovementDraft(...)` utk STOCK_SALE otomatis buat jurnal linked via posting rules.

- [ ] Test `stock.spec.ts`: IN 20 confirm + OUT 5 confirm + OUT 3 draft → currentStock = 15 (draft tak dihitung). Implement. Endpoint: `/members` (+`?unpaid=true`), `/members/:id/simpanan`, `/members/:id/simpanan/pay`, `/business-units`, `/products`, `/products/:id/card`, `/stock-movements` (+`/confirm`). Verif curl penjualan → dua record linked. Commit `feat(api): master data, inventory-lite, simpanan`.

### Task 1.4: api: reports + dashboard (derived only)

**Files:** Create: `apps/api/src/reports/{reports.module,reports.service,reports.controller,reports.spec.ts}`
**Interfaces (Produces):** `GET /dashboard/summary` → `{totalAset,totalKewajiban,totalEkuitas,totalPendapatan,totalBeban,labaBersih,totalAnggota,totalSimpanan,nunggak, phuPerUnit[]}` · `GET /reports/{buku-besar,neraca-saldo,phu,neraca,buku-kas}` (param `from/to/month/date`, `&format=html` → tabel print-friendly).
**Konsumsi:** journal_lines saja (tak ada tabel laporan).

- [ ] Test: seed data → neraca-saldo `totalDebit === totalKredit` (Status: "Neraca Seimbang"); PHU banyu > 0. Implement service (raw SQL groupBy coa.type & kode) + HTML renderer sederhana (satu template, header koperasi + tabel). Verif: buka `localhost:3001/reports/neraca-saldo?format=html`. Commit `feat(api): laporan derived (buku besar, neraca saldo, PHU, neraca, buku kas)`.

### Task 1.5: web: layar ERP

**Files:** Create di `apps/web/app/`: `(auth)/login/page.tsx` · `(dashboard)/layout.tsx` (sidebar ala CORE: Dashboard, Akuntansi▾ COA/Jurnal, Inventori▾ Produk/Stok, Master▾ Anggota/Simpanan/Unit, Laporan▾ 5 laporan) · `dashboard/page.tsx` (kartu) · `coa/page.tsx` (tree) · `jurnal/page.tsx` (+dialog jurnal sederhana & manual; tombol Confirm utk DRAFT; badge sumber WHATSAPP) · `produk/page.tsx` + `produk/[id]/page.tsx` (kartu stok) · `anggota/page.tsx` (+dialog bayar simpanan rapel; kolom status per periode) · `laporan/[jenis]/page.tsx` (iframe/fetch html) · `lib/api.ts` (fetch wrapper JWT).
**Konsumsi:** semua endpoint 1.1–1.4.

- [ ] Bangun berurutan: login→dashboard→jurnal→produk→anggota→laporan. Polling ringan di jurnal & dashboard (`refetch setiap 5s`) supaya entri dari WA "muncul live" saat demo. Verif manual browser per halaman. Commit per halaman (`feat(web): …`).

---

# FASE 2 — Bot DM core (webhook → agent → jurnal) · target jam 10–18

### Task 2.1: api: WhatsappGateway interface + adapter GoWA

**Files:** Create: `apps/api/src/whatsapp/{whatsapp.module,gateway.interface.ts,gowa.adapter.ts,gowa.adapter.spec.ts}`
**Interfaces (Produces):**

```ts
export interface InboundMessage {
  chatJid: string;        // "628xx@s.whatsapp.net" | "1203xx@g.us"
  senderNumber: string;   // 628xx (pengirim asli, juga utk grup)
  isGroup: boolean;
  text?: string;
  mentionedJids: string[];
  mediaType?: "image"|"audio"|"document";
  messageId: string;
  groupName?: string;
}
export interface WhatsappGateway {
  parseWebhook(body: unknown, signatureHeader: string|undefined, rawBody: Buffer): InboundMessage|null; // verifikasi HMAC-SHA256; null utk event non-message
  sendText(toJid: string, text: string): Promise<void>;
  downloadMedia(messageId: string): Promise<Buffer>;
  getGroupParticipants(groupJid: string): Promise<string[]>; // nomor E.164 tanpa +
}
```

- [ ] Test HMAC: payload contoh + secret → signature valid diterima, salah → null/throw. Implement adapter GoWA (`POST /send/message`, `GET /message/:id/download`, endpoint grup sesuai hasil spike 0.4-3; mention fallback = deteksi `@<botNumber>` di text kalau payload tak sediakan). Commit `feat(api): whatsapp gateway interface + adapter gowa`.

### Task 2.2: agent: tools + agent kopra + workflow recordEntry

**Files:** Create di `apps/agent/src/mastra/`: `agents/kopra.ts` · `tools/{create-entry-draft,record-stock-movement,get-stock-levels,get-financial-summary,list-unpaid-members,generate-report,search-koperasi-guides}.ts` · `workflows/record-entry.ts` · `lib/api-client.ts` (panggil api dgn service token) · `lib/runtime-context.ts`
**Interfaces (Consumes):** endpoint api Fase 1. **Produces:** Mastra server expose agent `kopra` + workflow `recordEntry`; SEMUA tool menerima `runtimeContext: {koperasiId, userId, role, channel: "DM"|"GROUP"}` dan **gate**: CRUD tools throw `FORBIDDEN_CHANNEL` kalau `channel==="GROUP"`, throw `FORBIDDEN_ROLE` kalau `role!=="PENGURUS"`; `getFinancialSummary` & `listUnpaidMembers` juga GROUP-forbidden (matriks akses).

- [ ] Tools = wrapper tipis ke api (fetch + zod schema). System prompt kopra: bahasa sederhana, tak pernah berhitung, arahkan aksi grup→DM, sebut dirinya "Kopra".
- [ ] `record-entry.ts` workflow: step `parse` (agent ekstrak `SimpleEntryInput`) → `createDraft` via api → `suspend({draftSummary})` → resume input `{answer}`: "YA|ya|y" → `POST /journals/:id/confirm` (atau movement confirm) → return sukses+saldo; "batal|gajadi" → DELETE; lainnya → langkah revisi (agent revisi input → PATCH → suspend lagi).
- [ ] Test via `mastra dev` playground: "catat pemasukan banyu 500rb" → draft muncul di web (DRAFT) → resume "YA" → CONFIRMED. Commit `feat(agent): kopra agent, 7 tools (RBAC-gated), workflow recordEntry`.

### Task 2.3: api: webhook orchestrator + state machine DM

**Files:** Create: `apps/api/src/whatsapp/{webhook.controller.ts,conversation.service.ts,conversation.spec.ts}`
**Interfaces (Consumes):** gateway 2.1, Mastra API 2.2 (`/api/agents/kopra/generate`, `/api/workflows/recordEntry/{start,resume}`), `whatsapp_identities`.
**Logic (deterministik — TDD):**

```
onMessage(m):
  if m.isGroup → Fase 4 handler (sementara: abaikan)
  identity = findIdentity(m.senderNumber)
  if !identity → guestFlow(m)          // Fase 3; sementara: intro + "ketik DAFTAR"
  ctx = {koperasiId, userId, role, channel:"DM"}
  if ada suspended recordEntry run utk chatJid → resume(answer=m.text)
  elif role==PENGURUS dan intent aksi → start recordEntry (agent yg memutuskan via tool call)
  else → agent.generate (RAG/query sesuai RBAC)
  sendText(reply)
```

- [ ] Test `conversation.spec.ts`: (a) suspended + "YA" → resume dipanggil; (b) suspended + teks lain → resume(answer=teks); (c) tak dikenal → intro; (d) anggota tanya keuangan → jawaban penolakan sopan (tool gate). Simpan mapping `chatJid→runId` di tabel kecil `wa_runs` (tambahkan model: `id, chatJid @unique, runId, createdAt`) — atau Mastra suspended-run query kalau tersedia (cek docs skills). Commit `feat(api): webhook orchestrator + state machine DM`.

### Task 2.4: RAG P1 ingest + tool nyala

**Files:** Create: `apps/agent/src/rag/{ingest.ts,corpus/}` · `rag_corpus/` root berisi: `panduan-pembukuan-*.md` (tulis 3 file ringkas dari pengetahuan akuntansi koperasi standar: klasifikasi transaksi, buku kas→jurnal, laba-rugi/PHU), salinan `docs/data/kdmp-modules-tutorial/*.md` (sourceType `module_tutorial`), transkrip interview (sourceType `field_research`), konsep koperasi dasar (simpanan/SHU/RAT, dari UU 25/1992 pasal inti — kutip pasal eksplisit).
**Interfaces:** `pnpm --filter agent ingest` → chunk 800 token overlap 100 → embed → `rag_documents`; `searchKoperasiGuides(query)` → top-5 + sumber.

- [ ] Ingest jalan; uji playground: "beli stok air masuk operasional atau persediaan?" → jawaban menyebut PERSEDIAAN + sumber; "cara pakai aplikasi CORE?" → jawab dari module_tutorial. Commit `feat(agent): rag ingest P1 + module tutorials`.

**🎯 Checkpoint Fase 2 (jam ~18): demo inti hidup end-to-end** — WA "catat pemasukan banyu 500rb" → YA → muncul CONFIRMED di web ± 5 detik. Rekam video kasar sebagai asuransi pertama.

---

# FASE 3 — Registrasi dual-flow + notifikasi · target jam 18–24

### Task 3.1: api: registration service (logika NIK-match — TDD)

**Files:** Create: `apps/api/src/registration/{registration.module,registration.service,registration.controller,tokens.service,registration.spec.ts}`
**Interfaces (Produces):**

```ts
// tokens.service
issueMagicLink(waNumber, payload): Promise<string>   // return URL `${APP_PUBLIC_WEB_URL}/register/complete?token=...`
issueOtp(waNumber, payload): Promise<string>          // return kode 6 digit (dikirim via bot DM)
consume(tokenRaw, type): Promise<payload>             // sekali pakai, cek expiry

// registration.service
searchKoperasi(q): Promise<{ref,nama,wilayah,onboarded:boolean}[]>  // dari koperasi_directory + koperasi
registerViaWeb(dto: {nama,nik,waNumber,password,role,koperasiRefOrId | newKoperasiName}): Promise<{userId, next:"OTP"}>
completeWaRegistration(token, dto: {nama,nik,password}): Promise<AttachResult>
verifyOtp(userId, code): Promise<AttachResult>
approve(pengurusUserId, pendingUserId): Promise<void>
type AttachResult = {status:"ACTIVE"|"PENDING_APPROVAL", koperasiId, role}
```

**Aturan attach (LOCKED, dari keputusan user):**
1. Role PENGURUS + koperasi BELUM terdaftar di Kopra → auto-onboard: buat `Koperasi` dari directory (atau nama manual bila tak ada di directory — MVP tanpa validasi, catat disclaimer merujuk https://simkopdes.go.id/survey/permohonan-akun) → user langsung `ACTIVE` PENGURUS (first-claimer).
2. Koperasi sudah ada → cek NIK di `members`: **match** → auto-attach `ACTIVE` (link `memberId`, update `member.waNumber`) + notify pengurus "akun dengan NIK x telah terdaftar dgn nomor y"; **tidak match** → `PENDING_APPROVAL` + notify pengurus utk approve.
3. Kebalikan juga berlaku: kalau pengurus menambah member (dgn NIK) SETELAH ada user PENDING ber-NIK sama → auto-attach saat itu (hook di members.service.create).

- [ ] **Step 1 (test dulu):** spec cases: first-claimer pengurus → ACTIVE; NIK match → ACTIVE+memberId; NIK no-match → PENDING; approve → ACTIVE; member-created-later → auto-attach; OTP salah/expired → error. FAIL dulu → implement → PASS.
- [ ] **Step 2:** Controller: `GET /registration/koperasi?q=` (public) · `POST /registration/web` · `POST /registration/verify-otp` · `POST /registration/complete-wa` · `GET /registration/pending` + `POST /registration/:userId/approve` (@Roles PENGURUS).
- [ ] **Step 3:** `notification.service.ts` kecil: `notifyPengurus(koperasiId, text)` → cari identities user PENGURUS koperasi itu → `gateway.sendText` masing-masing.
- [ ] Commit `feat(api): registrasi dual-flow (magic link, OTP, NIK matching, approval) — TDD`.

### Task 3.2: Bot guest flow (WA-side registration)

**Files:** Modify: `apps/api/src/whatsapp/conversation.service.ts` (guestFlow) · Create: `apps/api/src/whatsapp/guest-flow.spec.ts`
**Flow (deterministik, state di tabel `wa_runs.payloadJson` atau enum step di memori DB — bukan LLM):**

```
Guest kirim apa pun pertama kali →
  intro Kopra + "Anda bisa bertanya seputar koperasi, atau ketik DAFTAR untuk mendaftar."
  (pertanyaan biasa → agent RAG-only ctx {role:"GUEST"})
"DAFTAR" → "Anda pengurus atau anggota koperasi? (balas: PENGURUS / ANGGOTA)"
role dibalas → "Ketik nama koperasi Anda:" → searchKoperasi(q) top-5 bernomor
  (pengurus + tidak ketemu → tawarkan "BARU <nama koperasi>" utk onboard baru)
user pilih nomor → issueMagicLink(waNumber, {role, koperasiRef}) →
  "Lanjutkan pendaftaran di link ini (isi nama, NIK & password — jangan kirim NIK di chat): <url>"
selesai form web (Task 3.3) → AttachResult → bot kirim hasil:
  ACTIVE → "Selamat datang di <koperasi>!" · PENDING → "Menunggu persetujuan pengurus."
```

- [ ] Test: transisi step & guard (jawaban di luar opsi → ulangi pertanyaan). Verif manual dari HP. Commit `feat(api): guest flow registrasi via WA`.

### Task 3.3: web: halaman registrasi (2 pintu) + approval

**Files:** Create: `apps/web/app/(auth)/register/page.tsx` (form web-first: nama, NIK, nomor WA, password, role, cari koperasi [combobox `GET /registration/koperasi?q=`], atau "daftarkan koperasi baru" bila PENGURUS) · `register/verify/page.tsx` (input OTP 6 digit) · `register/complete/page.tsx` (dari magic link: token di query → form nama+NIK+password saja) · `(dashboard)/pengurus/persetujuan/page.tsx` (list pending → Approve).
- [ ] Verif E2E manual dua arah: (a) web→OTP: daftar di web (nomor tes) → bot DM kirim OTP → verify → login; (b) WA→link: DAFTAR di WA → link → form → bot konfirmasi. Commit `feat(web): registrasi web+OTP, complete-wa, approval pengurus`.

---

# FASE 4 — WhatsApp Group support · target jam 24–28

### Task 4.1: Group resolution service (TDD)

**Files:** Create: `apps/api/src/whatsapp/{group.service.ts,group.service.spec.ts}`
**Logic (LOCKED):**

```
onGroupMessage(m):
  grp = upsert WaGroup(m.chatJid, nama=m.groupName)
  if grp.status == PENDING:
     participants = gateway.getGroupParticipants(m.chatJid)
     kops = distinct koperasiId dari identities(participants) yg ACTIVE
     if len(kops)==1 → attach(grp, kops[0], by=system) + umumkan di grup
     else → (hanya saat bot di-mention) tanya: "Grup ini untuk koperasi mana?
             (balas mention saya + nama koperasi)" → jawaban dari user ber-identity
             (prioritas PENGURUS) → searchKoperasi → attach + umumkan
  if !mentioned(m) → simpan ke memory thread grup (konteks), JANGAN balas
  else → route ke agent ctx {koperasiId: grp.koperasiId, role: senderRole|GUEST, channel:"GROUP"}
```

- [ ] Test: 1 koperasi → auto-attach; 0/multi → bertanya saat mention; non-mention tak pernah menghasilkan sendText; CRUD di grup → balasan pengalihan "kirim perintah ini via DM ya 🙏" (dari tool-gate error map). Commit `feat(api): group resolution + mention-only routing`.

### Task 4.2: Group context memory + read-scope

**Files:** Modify: `apps/api/src/whatsapp/webhook.controller.ts` (route grup) · `apps/agent/src/mastra/agents/kopra.ts` (system prompt cabang GROUP: jawab ringkas, arahkan aksi ke DM, jangan bocorkan ringkasan keuangan/penunggak — plus gate keras di tools sudah ada dari 2.2)
- [ ] Semua pesan grup (termasuk non-mention) di-append ke Mastra memory thread `group:<jid>` supaya bot punya konteks percakapan saat akhirnya di-mention.
- [ ] Verif manual: grup tes 3 nomor (2 terdaftar 1 tidak) → auto-attach; mention "stok minyakita berapa?" → dijawab; mention "catat pemasukan…" → diarahkan DM; mention "ringkasan keuangan" → ditolak sopan arahkan DM pengurus. Commit `feat: group read-only context`.

---

# FASE 5 — Chat web, landing, korpus P2, polish · target jam 28–31

- [ ] **5.1** `apps/web/app/chat/page.tsx`: chat asisten streaming ke Mastra (`/api/agents/kopra/stream`, JWT di header; ctx dari token) — otak & gate yang sama. Commit.
- [ ] **5.2** Landing page: masalah (92% vs <1%, 640 vs 301, median 44) → solusi 3 langkah → arsitektur mini → CTA login demo. Commit.
- [ ] **5.3** Korpus P2: UU 25/1992 pasal inti + Inpres 9/2025 + FAQ KDMP → `rag_corpus/` → re-ingest. Commit.
- [ ] **5.4** Polish ERP: badge WHATSAPP di jurnal, empty states, format Rupiah `Intl.NumberFormat("id-ID")` konsisten. Commit.

# FASE 6 — Stretch media (urutan tetap) · target jam 31–33 (potong pertama kalau telat)

- [ ] **6.1 OCR nota:** webhook `mediaType==="image"` → `downloadMedia` → Claude vision (`claude-opus-4-8`, prompt ekstrak `{vendor,tanggal,items[],total}`) → `SimpleEntryInput` STOCK_PURCHASE/EXPENSE → masuk workflow recordEntry biasa (draft→YA).
- [ ] **6.2 Simpanan via WA:** intent "bu Sari bayar simpanan jan-mar 150rb" → tool savings.pay lewat recordEntry (kind SAVING_PAYMENT).
- [ ] **6.3 STT voice note:** `mediaType==="audio"` → Groq Whisper (`whisper-large-v3`, bahasa id) → teks → pipeline normal.

# FASE 7 — Deploy, demo assets, submission · target jam 33–36 (MULAI VPS LEBIH AWAL kalau bisa, jangan tunggu fase ini)

- [ ] **7.1** VPS GCP asia-southeast2 (ganti password akun GCP panitia dulu): docker compose full (Dockerfile per app — Node 20 alpine multi-stage), `APP_PUBLIC_WEB_URL` = IP/domain publik, GoWA `WEBHOOK_URL` → `http://api:3001/wa/webhook` (network bersama), re-pairing QR di VPS ATAU pindahkan volume `gowa_storages`.
- [ ] **7.2** Seed produksi + import 1 koperasi demo; smoke test semua flow dari HP.
- [ ] **7.3** **Rekam video demo ≤3 menit** (alur §10 spec) — upload unlisted.
- [ ] **7.4** README final (install, arsitektur, disclosure AI, kredensial juri akun demo), scan kredensial/PII terakhir (`grep -rE "H4ck4thon|34\.101|passwordHash contoh"`), submit portal: repo + deck + link demo + kredensial + video. **Sebelum deadline.**

---

## Risiko & mitigasi

| Risiko | Mitigasi |
|---|---|
| Payload GoWA beda dari asumsi (mention/participants/media) | Spike 0.4-3 di jam awal; hasil tulis `notes-gowa.md`; fallback mention = string `@nomor`; fallback participants = tanya manual di grup |
| Mastra suspended-run lookup per chat | Tabel `wa_runs` mapping sendiri (2.3) — tidak bergantung API internal Mastra |
| Nomor burner kena limit/banned | Video demo direkam di Checkpoint Fase 2 & sesudah tiap fase; jangan spam saat tes |
| Waktu habis | Urutan potong: 6.3 → 6.2 → 6.1 → 5.2/5.4 → grup attach manual only (4.1 tanya-manual tanpa auto-scan). JANGAN potong: F1 jurnal via WA, laporan, registrasi minimal satu arah (web+OTP) |
| Registrasi = permukaan abuse | MVP disclaimer di README; role PENGURUS first-claimer hanya utk koperasi yg belum onboarded; NIK unique constraint |

## Spec deltas (00-core-features.md — diterapkan bersama plan ini)
1. §5 F0 DIGANTI: guest = intro + RAG umum + flow DAFTAR (bukan tolak akses).
2. §Matriks akses baru (tabel di atas) — anggota DM = RAG-only.
3. §Fitur baru: Registrasi dual-flow (Fase 3) & Group support (Fase 4); model +4 (AuthToken, WaGroup, KoperasiDirectory, WaRun) → 19 model.
4. Framing web di README/pitch: "stand-in sistem existing" (integrasi-bukti), bukan produk ERP baru.
