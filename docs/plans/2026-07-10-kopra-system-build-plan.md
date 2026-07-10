# Kopra — Unified System Build Plan (v2 — hasil merge dua rencana)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.
> **Dokumen ini menggantikan:** `docs/plans/…-system-build-plan.md` v1 (Claude, commit `6a07521`) **dan** `docs/superpowers/specs/2026-07-10-kopra-whatsapp-erp-mvp-design.md` (GPT 5.6 + Aldio, commit `a377feab`). Satu-satunya rencana yang berlaku.

**Goal:** Sistem Kopra demo-ready 36 jam: web ERP stand-in (Finance ala CORE + Inventory-lite), bot WhatsApp ber-guardrail (CRUD via DM pengurus, preview→YA), registrasi dual-flow (WA↔web, OTP, NIK, approval super-admin), group support mention-only (read sesuai role, tanpa C/U/D) — di satu VM GCP.

**Architecture:** Monorepo pnpm `web`(Next.js) / `api`(NestJS) / `agent`(Mastra) / `packages/db`(Prisma) / **`packages/core` (shared domain rules)**. NestJS **dan** Mastra sama-sama akses Prisma langsung, tapi SEMUA aturan (policy role/channel, posting rules, validasi balance & stok, PendingAction, audit, redaksi NIK) hidup di `packages/core` — satu implementasi, dua konsumen (keputusan GPT diadopsi final). Next.js tak pernah menyentuh Prisma. Gateway = GoWA di balik `WhatsappGateway` interface. Sumber data resmi = import offline; runtime tidak pernah menyentuh DB panitia.

**Tech Stack:** Next.js · NestJS · Mastra · Prisma/Postgres16+pgvector (:5433) · GoWA **pinned `v8.6.0`** · Claude `claude-opus-4-8` · Argon2id · Caddy (HTTPS).

---

## Changelog merge — apa diambil dari mana (10 Jul malam)

| # | Topik | Keputusan final | Sumber |
|---|---|---|---|
| 1 | Struktur phased + task + kontrak interface | dipertahankan | plan Claude |
| 2 | Idempotensi & delivery: dedup inbound `(deviceId,eventId)`, outbox retry, duplicate-YA lock, `is_from_me` ignore | **diadopsi** | design GPT |
| 3 | `PendingAction` (ganti `WaRun`): 1 aktif per DM, preview, expiry 15m, terminal-check dalam transaksi | **diadopsi** | design GPT |
| 4 | Integrasi agent↔data: **Mastra akses Prisma langsung + `packages/core`** berisi seluruh domain rules — dikonsumsi api & agent, mencegah dua implementasi | **design GPT (final — keputusan Dika 10 Jul malam)** |
| 5 | Registrasi: `ImportedIdentity` + pencocokan **prefix NIK masked**, OTP hashed 3×/5m, magic link 15m, skip-form bila NIK lokal ada & phone null, konflik phone → eskalasi | **diadopsi** | design GPT |
| 6 | **Super-admin WhatsApp-only** (`SUPER_ADMIN_WA_NUMBER`, perintah deterministik PERMOHONAN/DETAIL/SETUJUI/TOLAK/PERAN) menggantikan "first-claimer langsung jadi pengurus" utk koperasi IMPORTED; koperasi LOCAL baru → OWNER setelah approval super-admin | **diadopsi** (mengganti jawaban first-claimer versi sore — abuse-proof, tetap cepat didemokan) | design GPT |
| 7 | Grup: konteks window 50 pesan/24 jam (tabel), rebind→UNRESOLVED bila member terdaftar koperasi ter-bind hilang, jawaban binding hanya boleh koperasi si penjawab | **diadopsi** | design GPT |
| 8 | Baca di GRUP mengikuti role (GPT): guest = tanya publik saja; MEMBER = + read Inventory; PENGURUS/OWNER = + read Finance. C/U/D tetap dilarang di grup (diarahkan DM) | **design GPT (final — keputusan Dika 10 Jul malam)** |
| 9 | MEMBER boleh **read Finance & Inventory (read-only) di DM & web — transparansi anggota**; CRUD tetap PENGURUS/OWNER. (Override sebelumnya DICABUT — matriks kini 100% mengikuti design GPT) | **design GPT (final — keputusan Dika 10 Jul malam)** |
| 10 | RAG: **Postgres full-text search dulu** (tsvector, tanpa embedding di jalur kritis); pgvector = upgrade opsional | **diadopsi** | design GPT |
| 11 | OCR nota, STT, **web-chat: CUT dari MVP** (backlog/roadmap, dikerjakan nanti) — tidak ada fase stretch media | **design GPT (final — keputusan Dika 10 Jul malam)** |
| 12 | NIK plaintext at rest (requirement produk) + redaksi ketat di log/prompt/response/audit | **diadopsi** | design GPT |
| 13 | Deploy: Caddy HTTPS, GoWA pinned, persistent disk, GoWA UI via SSH tunnel, snapshot pra-demo, demo tak bergantung DB panitia | **diadopsi** | design GPT |
| 14 | Loans/pinjaman, warehouse lanjutan (bin/batch/expiry/adjudication), POS/barcode, multi-koperasi per user, live-write DB panitia, Redis/BullMQ/microservices | tetap CUT | keduanya |

## Global Constraints

- Bahasa bot & UI Indonesia sederhana; istilah keuangan = CORE resmi (COA, Jurnal, Buku Besar, Neraca Saldo, PHU, Neraca).
- **LLM explains, backend calculates**; commit hanya setelah `YA` dari aktor yang sama, di transaksi Prisma yang mengunci `PendingAction` dan mengecek terminal-state (duplicate-YA aman).
- Semua query & mutasi scoped `koperasiId` (tak pernah menerima koperasiId dari LLM tanpa dibandingkan konteks resolved); semua mutasi & tool call → `audit_logs` (payload ter-redaksi, ada correlationId).
- CONFIRMED (jurnal & stock movement) immutable — koreksi = jurnal balik / movement ADJUST kompensasi. Produk ber-movement tak bisa dihapus → inactive.
- Qty & uang = Decimal; serialisasi angka desimal sebagai string; tanggal ISO-8601; REST berversi `/api/v1`; list endpoints ber-pagination + ordering deterministik.
- Keamanan: webhook HMAC-SHA256 header `X-Hub-Signature-256` atas **raw body**, constant-time compare, tolak sebelum parse JSON; password Argon2id; OTP disimpan hash (3 percobaan, TTL 300s); magic link TTL 900s single-use; PendingAction TTL 900s.
- **NIK**: plaintext at rest (requirement), UNIQUE; tidak pernah di response API biasa, log, trace, prompt LLM, pesan grup, atau `audit.payloadJson` (util redaksi di api). NIK hanya diinput via form web.
- GoWA: image pinned `ghcr.io/aldinokemal/go-whatsapp-web-multidevice:v8.6.0`; semua call device-scoped; abaikan `is_from_me`; UI admin tak diekspos publik (SSH tunnel).
- Ports: web 3000 · api 3001 · gowa 3002 · agent 4111 · postgres 5433 (mirror panitia lokal dev 5432). Env baru: `APP_PUBLIC_WEB_URL`, `OTP_TTL_SECONDS=300`, `MAGIC_LINK_TTL_SECONDS=900`, `PENDING_ACTION_TTL_SECONDS=900`, `SUPER_ADMIN_WA_NUMBER`. (agent & api satu network compose privat; agent tidak diekspos publik.)
- Test wajib (Vitest/Jest): matriks otorisasi penuh, posting rules & balance, stok (fraksional), state machine DM, NIK-match & prefix-match, group binding/rebind, dedup & duplicate-YA, redaksi NIK. UI = verifikasi manual/curl.
- Commit kecil & sering ke `main`, tanpa `Co-Authored-By`.

## Matriks akses FINAL

| Kapabilitas | GUEST | MEMBER (anggota) | PENGURUS | OWNER (koperasi LOCAL) | SUPER_ADMIN (WA-only) |
|---|---|---|---|---|---|
| Tanya publik koperasi (RAG) — DM/grup/web | ✅ | ✅ | ✅ | ✅ | hanya perintah approval |
| Lihat simpanan/profil DIRINYA (DM/web) | ❌ | ✅ | ✅ | ✅ | ❌ |
| Read Inventory & Finance (DM/web) | ❌ | ✅ read-only (transparansi) | ✅ | ✅ | ❌ |
| CRUD Finance/Inventory (DM preview→YA, web) | ❌ | ❌ | ✅ | ✅ | ❌ |
| Grup ter-bind: tanya publik (RAG) | ✅ | ✅ | ✅ | ✅ | ❌ |
| Grup ter-bind: read Inventory (stok, produk, kartu stok) | ❌ | ✅ | ✅ | ✅ | ❌ |
| Grup ter-bind: read Finance (dashboard, laporan, penunggak) | ❌ | ❌ | ✅ | ✅ | ❌ |
| Grup: Create/Update/Delete | ❌ semua — bot arahkan ke DM, tanpa PendingAction | ❌ | ❌ | ❌ | ❌ |
| Kelola role member LOCAL (web) | ❌ | ❌ | ❌ | ✅ | ❌ |
| Approve registrasi IMPORTED + koperasi baru + `PERAN` | ❌ | ❌ | ❌ | ❌ | ✅ |

## Data model delta (final ≈ 22 model — semua di `packages/db/prisma/schema.prisma`)

Inti 15 model spec §2 TETAP (COA/Journal/Lines, Product/StockMovement, Member/MemberSaving, dst). Perubahan & tambahan:

```prisma
enum UserRole { OWNER PENGURUS ANGGOTA }            // ganti enum Role lama
enum UserStatus { ACTIVE PENDING_OTP PENDING_APPROVAL REJECTED }
enum KoperasiOrigin { IMPORTED LOCAL }
enum KoperasiStatus { PENDING ACTIVE REJECTED }
enum RegType { MEMBER_JOIN NEW_KOPERASI }
enum RegStatus { AWAITING_FORM AWAITING_OTP PENDING_SUPER_ADMIN PENDING_OWNER APPROVED REJECTED EXPIRED }
enum WaGroupStatus { UNRESOLVED ATTACHED }
enum PendingState { AWAITING_CONFIRM CONFIRMED CANCELLED EXPIRED }

// User: + nik String? @unique, + status UserStatus, + role UserRole,
//       + koperasiId? (1 user = 1 koperasi), + memberId? @unique
// Koperasi: + origin KoperasiOrigin, + status KoperasiStatus @default(ACTIVE),
//           + managementMode "SUPER_ADMIN"|"OWNER" (String enum)

model ImportedIdentity {           // kandidat identitas dari DB panitia (BUKAN user)
  id         String @id @default(cuid())
  koperasiRef String              // KOP-…
  sourceTable String              // anggota|pengurus|karyawan_koperasi
  sourceRef   String @unique
  nama        String
  nikMasked   String?             // "3402**********01" → prefix match
  roleHint    String?
  @@index([koperasiRef, nikMasked])
  @@map("imported_identities")
}

model RegistrationRequest {
  id            String    @id @default(cuid())
  type          RegType
  channel       String    // WA|WEB
  waNumber      String
  nik           String?   // plaintext by-requirement; ter-redaksi di mana pun tampil
  nama          String?
  koperasiId    String?
  koperasiRef   String?   // directory ref utk IMPORTED yg belum onboarded
  newKoperasi   Json?     // {nama, alamat} utk NEW_KOPERASI
  candidateRef  String?   // ImportedIdentity.sourceRef pilihan super-admin
  status        RegStatus
  shortCode     String    @unique // "R-017" utk perintah WA super-admin
  expiresAt     DateTime  // 24 jam
  decidedById   String?
  createdAt     DateTime  @default(now())
  @@map("registration_requests")
}

model OtpChallenge {
  id        String   @id @default(cuid())
  waNumber  String
  otpHash   String
  attempts  Int      @default(0)     // max 3
  expiresAt DateTime
  usedAt    DateTime?
  requestId String?
  @@index([waNumber])
  @@map("otp_challenges")
}

model AuthToken {                    // magic link WA→web (single-use)
  id        String   @id @default(cuid())
  tokenHash String   @unique
  waNumber  String
  payload   Json     // {regRequestId}
  expiresAt DateTime
  usedAt    DateTime?
  @@map("auth_tokens")
}

model PendingAction {                // pengganti WaRun — satu aktif per chat DM
  id         String       @id @default(cuid())
  chatJid    String
  actorId    String
  koperasiId String
  actionType String       // JOURNAL_SIMPLE|JOURNAL_MANUAL|STOCK_MOVE|SAVING_PAY|COA_*|PRODUCT_*
  preview    Json         // efek lengkap yang ditampilkan ke user
  runId      String?      // Mastra workflow run (snapshot persisted)
  state      PendingState @default(AWAITING_CONFIRM)
  expiresAt  DateTime
  createdAt  DateTime     @default(now())
  @@index([chatJid, state])
  @@map("pending_actions")
}

model InboundWhatsappEvent {         // dedup webhook
  id        String   @id @default(cuid())
  deviceId  String
  eventId   String
  result    String?  // PROCESSED|IGNORED|ERROR
  createdAt DateTime @default(now())
  @@unique([deviceId, eventId])
  @@map("inbound_wa_events")
}

model OutboundWhatsappMessage {      // outbox + retry backoff
  id         String   @id @default(cuid())
  toJid      String
  text       String
  attempts   Int      @default(0)
  nextTryAt  DateTime @default(now())
  status     String   @default("QUEUED") // QUEUED|SENT|FAILED
  createdAt  DateTime @default(now())
  @@index([status, nextTryAt])
  @@map("outbound_wa_messages")
}

model WaGroup {
  id                String        @id @default(cuid())
  groupJid          String        @unique
  nama              String?
  status            WaGroupStatus @default(UNRESOLVED)
  koperasiId        String?
  boundByUserId     String?
  lastParticipantsAt DateTime?
  @@map("wa_groups")
}

model WaGroupMessage {               // konteks grup bounded: 50 pesan / 24 jam
  id        String   @id @default(cuid())
  groupJid  String
  sender    String
  text      String
  mentioned Boolean  @default(false)
  createdAt DateTime @default(now())
  @@index([groupJid, createdAt])
  @@map("wa_group_messages")
}

model KoperasiDirectory {            // 1.026 nama koperasi resmi (PII-free, di-commit)
  sourceRef String  @id
  nama      String
  wilayah   String?
  @@map("koperasi_directory")
}
```

---

# FASE 0 — Fondasi · jam 0–3

- [ ] **0.1 Scaffold 3 app** — persis README per folder (`create-next-app` / `nest new` / `create mastra` + `npx skills add mastra-ai/skills`); ketiganya hidup; commit.
- [ ] **0.2 Schema v3** — terapkan seluruh delta di atas (ganti `Role`→`UserRole`, hapus `WaRun` bila ada); `packages/db/src/index.ts` singleton; update `.env.example` (env baru di Global Constraints); `pnpm db:push` sukses; commit `chore(db): schema v3 unified (identitas, registrasi, delivery, grup)`.
- [ ] **0.3 Seed & import** — `coa-default.ts` (COA KDMP spec §2) · `gen-directory.ts` → `seed-data/koperasi-directory.json` (commit; nama publik) · `seed.ts` idempotent: koperasi demo IMPORTED "KDMP Palbapang (Demo)" + COA + 6 unit + user demo (`pengurus@kopra.id`/`kopra123` PENGURUS ACTIVE NIK `3402000000000001`; `anggota@kopra.id` ANGGOTA) + 15 member (+savings campuran, sebagian NIK penuh utk demo match) + 10 produk + ~60 jurnal kosakata asli + **opening ADJUST utk stok awal** + `ImportedIdentity` sampel ber-`nikMasked` · `import-koperasi.ts --ref` (profil, anggota→Member+ImportedIdentity, pengurus→ImportedIdentity, produk; simpanan per periode) · verif count. Commit.
- [ ] **0.4 GoWA hidup + SPIKE payload (WAJIB, tulis `docs/plans/notes-gowa.md`)** — compose repo infra pin `v8.6.0`; pairing QR nomor burner; kirim DM+grup tes; catat: field mention, `group.joined`/`group.participants`, endpoint participants & download, bentuk `X-Hub-Signature-256`. Fallback mention final = teks `@Kopra`/`@<nomorBot>`.

# FASE 1 — ERP Web stand-in (Finance + Inventory) · jam 3–10

> Framing README/pitch: web = **surrogate sistem existing** (CORE+Warehouse dari video tutorial) — bukti bot bisa menempel ke sistem yang tak kita punya aksesnya; tidak menulis ke DB pemerintah.

- [ ] **1.1 api: auth** — `POST /api/v1/auth/login` (Argon2id verify) → JWT `{sub,koperasiId,role,status}`; guard `@Roles(...)`; status ≠ ACTIVE → 403 `AKUN_PENDING`. Test login+role. Commit.
- [ ] **1.2 api: accounting core (TDD penuh)** — `posting-rules.ts` (`SimpleEntryInput` = kind INCOME|EXPENSE|STOCK_PURCHASE|STOCK_SALE|SAVING_PAYMENT → `buildLines()` balanced; test per tabel spec §2) · `journal.service` `createDraft/createManual/confirm/reject` (nomor `JU-xxx` per koperasi; confirm atomik + movement linked; immutability) · controllers `/coa`, `/journals`, `/journals/simple`, `/journals/:id/confirm`. Commit.
- [ ] **1.3 api: master+inventory+simpanan** — members(+savings.pay rapel→jurnal SAVING_PAYMENT), units, products (delete guard→inactive), stock (`currentStock`=SUM CONFIRMED signed, Decimal qty; STOCK_SALE auto-jurnal linked). Test stok & pay. Commit.
- [ ] **1.4 api: reports+dashboard derived** — `/dashboard/summary` (kartu CORE) · `/reports/{buku-besar,neraca-saldo,phu,neraca,buku-kas}` + `?format=html` print. Test: neraca saldo seimbang atas seed. Commit.
- [ ] **1.5 web: layar** — login → sidebar ala CORE → dashboard, COA(tree), Jurnal(+confirm, badge WHATSAPP, polling 5s), Produk+kartu stok, Anggota+simpanan(bayar rapel), Laporan ×5, **/pengurus/persetujuan** (pending OWNER-flow lokal). Semua halaman read-only untuk MEMBER (tombol aksi disembunyikan by role — transparansi anggota). Commit per halaman.

# FASE 2 — Bot DM core · jam 10–18

- [ ] **2.1 api: WhatsappGateway + adapter GoWA (TDD HMAC)** — interface: `parseWebhook(raw, sig) → InboundMessage|null` (`chatJid, senderNumber, isGroup, text, mentionedJids, mediaType, messageId, groupName, deviceId, eventId, isFromMe`) · `sendText` (via **outbox**: tulis `OutboundWhatsappMessage`, worker interval 2s kirim+backoff) · `downloadMedia` · `getGroupParticipants`. Ignore `isFromMe`. Commit.
- [ ] **2.2 api: idempotensi** — webhook handler: upsert `InboundWhatsappEvent(deviceId,eventId)`; duplikat → 200 tanpa proses. Test dedup. Commit.
- [ ] **2.3 packages/core + agent: kopra + tools ber-gate** — buat `packages/core` (`policy.ts` can(actor,capability,channel) sesuai Matriks · `posting-rules.ts` · `journal.ts` validate+confirm · `stock.ts` · `pending-action.ts` create/confirm/cancel (lock + terminal-check) · `audit.ts` · `redact.ts` NIK) — **api & agent konsumsi core yang sama; refactor service 1.2–1.4 ke core di task ini**. Tools agent = fungsi TS langsung `@kopra/db` + `@kopra/core` dgn konteks resolved `{actorId,koperasiId,role,channel}` (BUKAN dari LLM): read `getCooperativeProfile, listCoaAccounts, listJournalEntries, getFinancialDashboard, generateFinancialReport, listProducts, getStockLevels, getStockCard, getMySavings, listUnpaidMembers, searchCooperativeGuidance`; write-draft `createEntryDraft (SimpleEntryInput), createManualJournalDraft, recordStockMovementDraft, paySavingDraft, createProductDraft, createCoaDraft`. **Gate keras via core.policy.can() di tiap tool** per Matriks (DM/web: read Finance+Inventory minimal MEMBER, write minimal PENGURUS; grup: write selalu FORBIDDEN_CHANNEL, finance-read butuh PENGURUS/OWNER, inventory-read minimal MEMBER). System prompt: bahasa sederhana, tak berhitung, arahkan aksi grup→DM. Tak ada tool SQL generik. Commit.
- [ ] **2.4 api+agent: PendingAction flow (TDD)** — write-draft tool → core.pendingAction.create() buat draft + `PendingAction(AWAITING_CONFIRM, preview, expiresAt)` (tolak jika sudah ada aktif utk chatJid) → bot kirim preview lengkap → balasan: `YA` → core.pendingAction.confirm(id) transaksi: lock row, cek state+expiry, confirm jurnal/movement, set CONFIRMED → balas sukses+saldo; `BATAL` → CANCELLED+hapus draft; teks lain → revisi preview (update draft+preview). Test: duplicate YA sekali efek; expiry; satu-aktif-per-chat. Commit.
- [ ] **2.5 api: webhook orchestrator DM** — resolve identity → GUEST → intro+RAG+tawaran DAFTAR (Fase 3 melengkapi); ACTIVE → cek `PendingAction` AWAITING utk chatJid → jalur konfirmasi; else → agent generate (konteks role). Semua balasan via outbox. Test state machine. Commit.
- [ ] **2.6 RAG FTS P1** — `rag_documents` + kolom `tsv tsvector` (generated, config `indonesian` fallback `simple`) + GIN index; ingest `rag_corpus/` (panduan pembukuan 3 file ditulis, tutorial modules, interview field_research, konsep UU 25/1992 pasal inti) · `searchCooperativeGuidance` = FTS top-5 + sumber (embedding = TIDAK di jalur kritis). Uji playground. Commit.

**🎯 Checkpoint (jam ~18):** WA "catat pemasukan banyu 500rb" → preview → YA → CONFIRMED muncul di web ≤5s. **Rekam video asuransi #1.**

# FASE 3 — Registrasi + approval · jam 18–25

- [ ] **3.1 api: registration service (TDD)** — `searchKoperasi(q)` (directory+lokal, flag onboarded) · `startWaRegistration(waNumber, role, koperasiRef|newKoperasi)` → RegistrationRequest(AWAITING_FORM)+magic link · `completeForm(token,{nama,nik,password})` → OTP challenge (skip-form jika NIK lokal exact ada & phone null) · `verifyOtp(waNumber,code)` (hash, 3×) → routing status: **IMPORTED → PENDING_SUPER_ADMIN (selalu)**; LOCAL join → PENDING_OWNER; NEW_KOPERASI → PENDING_SUPER_ADMIN · kandidat = `ImportedIdentity` by koperasi + **prefix nikMasked match** · `approve/reject` (+`candidateRef` utk pilih kandidat; approve NEW_KOPERASI → Koperasi LOCAL ACTIVE + OWNER) · hook members.create → auto-attach PENDING ber-NIK sama · notifikasi WA (pemohon + approver). Test semua cabang (match/ambigu/zero, konflik phone, expiry 24h, OTP salah 3×). Commit.
- [ ] **3.2 api: super-admin WA commands (deterministik, PRA-LLM, TDD parser)** — hanya dari `SUPER_ADMIN_WA_NUMBER`: `PERMOHONAN` (list shortCode) · `DETAIL R-017` (ringkasan ter-redaksi + kandidat ref) · `SETUJUI R-017 [ref]` · `TOLAK R-017 <alasan>` · `PERAN <userRef> MEMBER|PENGURUS` (koperasi IMPORTED). Idempotent + audit. Commit.
- [ ] **3.3 api: guest flow WA** — intro → tanya biasa = RAG · `DAFTAR` → "PENGURUS/ANGGOTA/KOPERASI BARU?" → cari koperasi (top-5 bernomor) → magic link ("isi nama, NIK & password di sini — jangan kirim NIK di chat") → status updates via notifikasi. Test transisi. Commit.
- [ ] **3.4 web: register pages** — `/register` (web-first: form+OTP), `/register/complete?token=` (dari WA), `/register/verify` (OTP), status menunggu approval. Verif E2E dua arah dengan nomor tes. Commit.

# FASE 4 — Group support · jam 25–29

- [ ] **4.1 group resolution (TDD)** — event join/first-message → upsert WaGroup + `getGroupParticipants` → map identities ACTIVE → 1 koperasi distinct → ATTACHED (umumkan); 0/multi → UNRESOLVED; saat mention di UNRESOLVED → tanya; **jawaban hanya diterima dari user terdaftar dan hanya untuk koperasinya sendiri** (prioritas PENGURUS/OWNER) → ATTACHED; participant change → refresh; bila tak ada lagi member terdaftar koperasi ter-bind → kembali UNRESOLVED. Commit.
- [ ] **4.2 group context + routing** — SEMUA pesan teks grup → `WaGroupMessage` (prune: simpan 50 terbaru, hapus >24h); non-mention → simpan saja, **tanpa balasan**; mention (native dari spike, fallback `@Kopra`) → agent ctx `{channel:"GROUP", koperasiId, role: senderRole|GUEST}` + 20 pesan konteks terakhir; read mengikuti Matriks (guest=RAG, MEMBER=+inventory, PENGURUS/OWNER=+finance); write → penolakan sopan + arahan DM (tanpa PendingAction). Verif grup nyata 3 nomor. Commit.

# FASE 5 — Polish web + korpus · jam 29–31

- [ ] **5.1** Landing (angka 92%/<1%, 640vs301, median 44 → 3 langkah solusi → CTA login demo). **5.2** Korpus P2 (UU 25/1992 pasal inti, Inpres 9/2025, FAQ KDMP) re-ingest. **5.3** Polish: format `Intl.NumberFormat("id-ID")`, empty states, badge sumber. Commit per item.

# FASE 6 — Deploy production-like · jam 31–34 (mulai lebih awal bila bisa)

- [ ] **6.1** VM GCP asia-southeast2 (ganti password akun panitia) + Persistent Disk utk volume postgres & `gowa_storages`; compose full: **caddy** (HTTPS) + web + api + agent + postgres + gowa `v8.6.0`; hanya 22/80/443 publik; GoWA UI via SSH tunnel; `APP_PUBLIC_WEB_URL` = domain/IP publik.
- [ ] **6.2** Seed + import 1 koperasi demo di VM; re-pairing QR (atau pindah volume); **smoke test dari HP**: registrasi 2 arah, DM CRUD→YA, grup bind+mention, laporan web. Snapshot disk pra-demo.

# FASE 7 — Demo assets & submission · jam 34–36

- [ ] Video final ≤3 menit (alur demo spec §10 + momen grup) · README final (install per service, arsitektur, framing surrogate, disclosure AI, kredensial juri) · scan kredensial/PII (`grep -rE "H4ck4thon|34\.101|sk-ant-"` + cek NIK di log) · submit portal SEBELUM deadline.

# CUT dari MVP (backlog/roadmap — JANGAN dibangun di sprint)

OCR nota · STT voice note · **web-chat (tidak ada)** · pinjaman/financing-application · warehouse lanjutan (bin/batch/expiry/adjudication/transfer) · POS/barcode/payment gateway · multi-koperasi per user · live-write DB pemerintah · Redis/BullMQ/microservices · vector-RAG di jalur kritis.

---

## Acceptance criteria (gerbang "MVP selesai" — dari design GPT, disesuaikan)

1. Compose penuh start di VM baru dari perintah terdokumentasi.
2. Web Finance+Inventory jalan atas data seed+import; laporan seimbang.
3. Kedua kanal registrasi jalan; approval IMPORTED & koperasi baru hanya via WA super-admin; LOCAL join via OWNER web.
4. Satu flow CRUD Finance + satu Inventory dari DM selamat **restart service saat menunggu YA** (PendingAction + snapshot Mastra).
5. Webhook duplikat & `YA` berulang tidak menggandakan efek.
6. Grup nyata: bind otomatis/manual, mention-only, read ringan sesuai matriks, write/finance → redirect DM tanpa draft.
7. Semua unit/contract/integration test hijau.
8. Tidak ada secret/NIK utuh/PII di history repo & log runtime.
9. Demo tetap jalan dengan DB panitia mati.

## Risiko (gabungan)

| Risiko | Mitigasi |
|---|---|
| Payload GoWA ≠ asumsi (mention/participants/signature) | Spike 0.4 jam pertama + `notes-gowa.md`; fallback mention teks `@Kopra`; fallback participants → binding manual |
| Nomor burner limit/banned | outbox rate ≤1 msg/dtk; video asuransi tiap checkpoint |
| Super-admin flow memakan waktu | perintahnya 5 dan deterministik (regex, tanpa LLM) — bila kritis, `SETUJUI` saja yang wajib demo |
| Restart saat menunggu YA | PendingAction di DB + Mastra snapshot (acceptance #4 diuji eksplisit) |
| Waktu habis | potong: 5.2 korpus P2 → grup auto-scan (sisakan binding manual) → polish laporan html → super-admin sisakan SETUJUI saja. JANGAN potong: DM CRUD→YA, registrasi ≥1 arah penuh, grup mention read sesuai matriks, laporan inti, dedup/idempotensi |
