# Workstream development/dika — WhatsApp Bot Logic + RAG (Fase 2 → 3-bot → 4)

## Context

Fase 0 selesai di `main` (schema v3 23 tabel ter-seed di PG18 lokal, GoWA v8.6.0 jalan native :3002, spike payload TERVERIFIKASI di `docs/plans/notes-gowa.md`). Docker & GCP di-skip (keputusan user). Sekarang pindah ke branch **`development/dika`** untuk bagian Dika: **seluruh logika bot WhatsApp + RAG**, sesuai unified plan Fase 2, 3 (sisi-WA), dan 4. Aldio paralel di `development/aldio` (web + api CRUD/laporan Fase 1).

**Batas wilayah (hindari konflik merge):** Dika menulis di `packages/core/`, `apps/agent/`, `apps/api/src/whatsapp/`, `apps/api/src/registration/` (service+WA flows), `rag_corpus/`. Aldio di `apps/web/`, `apps/api/src/{auth,koperasi,accounting,reports}/`. Satu titik singgung: `apps/api/src/app.module.ts` (registrasi module — konflik kecil, resolve manual saat merge ke main).

**Penyederhanaan disengaja vs unified plan:** Mastra workflow suspend/resume TIDAK dipakai untuk konfirmasi YA. `PendingAction` (tabel DB) SUDAH menjadi state machine yang tahan restart — orchestrator di api menangani YA/BATAL/koreksi secara deterministik, agent Mastra hanya untuk intent-extraction/Q&A/RAG. Lebih sedikit moving parts, acceptance #4 (restart-safe) tetap terpenuhi via DB. `PendingAction.runId` dibiarkan null.

## Prasyarat runtime
- `.env` root + `apps/agent/.env`: `ANTHROPIC_API_KEY` (bot butuh Claude `claude-opus-4-8`).
- Postgres lokal `kopra` (sudah seeded); `packages/db/.env` sudah ada.
- GoWA native: `D:/Hackathon/gowa-local/start-gowa.cmd` (admin:kopra-dev, webhook→`http://localhost:3001/api/v1/whatsapp/webhook`, secret `kopra-webhook-dev-secret`).
- Pairing QR (human) hanya untuk uji WhatsApp NYATA; semua milestone diverifikasi dulu via **fake-webhook script** (POST payload ber-HMAC valid) tanpa HP.

---

## M0 — Tooling agentic dev: Mastra Skills + MCP (GoWA & Mastra)

Karena seluruh alur agentic app dikerjakan via coding agents, pasang dulu alat bantunya:

1. **Mastra Skills** (docs Mastra untuk coding agents, offline): `npx skills add mastra-ai/skills` di root repo → commit hasilnya (folder skills) supaya Codex/Claude Aldio juga dapat.
2. **Mastra MCP docs server** — daftarkan di `.mcp.json` root repo (di-commit, dipakai semua sesi Claude Code):
```json
{
  "mcpServers": {
    "mastra-docs": { "command": "npx", "args": ["-y", "@mastra/mcp-docs-server"] },
    "gowa": { "type": "sse", "url": "http://localhost:8080/sse" }
  }
}
```
3. **GoWA MCP** — binary yang sama, mode MCP: `windows-amd64.exe mcp --port 8080` (SSE `/sse`). Tambah `start-gowa-mcp.cmd` di `D:/Hackathon/gowa-local/`.
   ⚠️ **Caveat**: mode `rest` dan `mcp` adalah dua proses yang berbagi storage session (SQLite) — JANGAN dijalankan bersamaan (lock conflict). Aturan pakai: `rest` = default (webhook pipeline); `mcp` dinyalakan on-demand untuk kirim pesan tes manual dari Claude Code, lalu matikan. Fake-webhook script tetap jalur verifikasi utama.
4. Verifikasi: `/mcp` menampilkan kedua server; tanya mastra-docs satu API (mis. runtimeContext) untuk memastikan hidup.

## M1 — packages/core: domain rules bot (TDD, vitest)

**Files (create):** `packages/core/src/{policy.ts, posting-rules.ts, journal.ts, stock.ts, savings.ts, pending-action.ts, audit.ts}` + `*.spec.ts` per file; update `src/index.ts` re-export; `packages/core/vitest.config.ts`; tambah dep `@kopra/db` (sudah), `decimal.js` tidak perlu (pakai Prisma.Decimal).

- `policy.ts` — `type Channel = "DM"|"GROUP"|"WEB"`; `type Capability = "PUBLIC_QA"|"READ_SELF"|"READ_INVENTORY"|"READ_FINANCE"|"WRITE_ERP"|"MANAGE_LOCAL_ROLES"|"SUPER_ADMIN"`; `can(actor:{role:UserRole|"GUEST", }, cap, channel): boolean` — implementasi persis Matriks akses FINAL unified plan (MEMBER read finance DM/web ✅ transparansi; GRUP: finance-read hanya PENGURUS/OWNER, write selalu false).
- `posting-rules.ts` — `SimpleEntryInput {koperasiId, kind: INCOME|EXPENSE|STOCK_PURCHASE|STOCK_SALE|SAVING_PAYMENT, amount?, description, businessUnitId?, via?: KAS|BANK, meta?{productId, qty, hargaBeli, memberId, periods[], savingType}}`; `buildLines(input, coaMap): {coaKode,debit,kredit}[]` — tabel posting spec §2 (INCOME→Dr 111000/Cr 41x per unit; EXPENSE→Dr 510000/Cr Kas; STOCK_PURCHASE→Dr 114000/Cr Kas; STOCK_SALE→Dr Kas/Cr 410000 (qty×hargaJual produk); SAVING_PAYMENT→Dr Kas/Cr 310000|320000). `via=BANK`→112100.
- `journal.ts` — `createDraftFromSimple(actorId, input)` (nomor `JU-xxx` per koperasi dlm transaksi; validasi unit & akun ada), `createManualDraft`, `confirmEntry(actorId, entryId)` ($transaction: cek DRAFT, set CONFIRMED, kalau ada `stockMovement` linked confirm juga; immutability), `rejectEntry` (hapus DRAFT cascade).
- `stock.ts` — `currentStock(productId)` = SUM signed CONFIRMED; `createMovementDraft(actorId,{productId,type,qty,harga…})` → utk SALE/PURCHASE sekalian buat jurnal draft linked (pakai posting-rules); fuzzy match nama produk (`ILIKE %q%`, ambil terbaik).
- `savings.ts` — `payDraft(actorId,{memberId,periods[],amount,savingType})` → jurnal draft SAVING_PAYMENT + preview periode; `confirm` (di journal.confirm hook: kalau actionType SAVING_PAY → set periods PAID + journalEntryId).
- `pending-action.ts` — `createPending({chatJid,actorId,koperasiId,actionType,preview,targetRef})` (tolak jika masih ada AWAITING utk chatJid); `confirmPending(chatJid, actorId)` ($transaction: `SELECT … FOR UPDATE`-equivalent via updateMany state guard, cek expiry & actor sama, dispatch by actionType → journal.confirm/…, set CONFIRMED); `cancelPending`; `getAwaiting(chatJid)`; expiry 900s (`PENDING_ACTION_TTL_SECONDS`).
- `audit.ts` — `writeAudit({koperasiId,actorId,channel,action,resourceType,resourceRef,result,payload})` → redactJson sebelum simpan (reuse `redact.ts` yg sudah ada).

**Tests wajib:** matriks policy penuh (5 role × capability × channel) · posting rules balanced semua kind · confirm atomik jurnal+movement · duplicate confirm = sekali efek · satu pending per chat · expiry.
**Verify:** `pnpm --filter @kopra/core test` hijau. Commit per file-group.

## M2 — Gateway GoWA + webhook plumbing (apps/api/src/whatsapp/)

**Files (create):** `whatsapp.module.ts`, `gateway.ts` (interface+adapter), `gateway.spec.ts`, `webhook.controller.ts`, `outbox.service.ts`, `dedup.service.ts`; modify `apps/api/src/main.ts` (`NestFactory.create(AppModule,{rawBody:true})`), `app.module.ts` (import WhatsappModule), `apps/api/package.json` (tak perlu dep baru — pakai fetch bawaan Node 22).

- `gateway.ts` — sesuai notes-gowa TERVERIFIKASI: `parseWebhook(rawBody:Buffer, sigHeader): InboundMessage|null` (HMAC-SHA256 hex, prefix `sha256=`, constant-time via `crypto.timingSafeEqual`; skip `is_from_me`; `isGroup = chat_id.endsWith("@g.us")`; fields: deviceId, messageId=payload.id, chatJid=chat_id, senderNumber=from sebelum "@", text=body, fromName); `sendText(deviceId,toJid,text)` → **outbox** (tulis OutboundWhatsappMessage, worker interval 2s POST `/send/message` header `X-Device-Id`, basic auth, backoff attempts≤5, rate ≤1 msg/detik); `getGroupParticipants(deviceId,groupJid)`; `downloadMedia(deviceId,messageId)` (stub — media backlog).
- `dedup.service.ts` — `markSeen(deviceId,eventId): boolean` (create InboundWhatsappEvent, unique violation → false=duplikat).
- `webhook.controller.ts` — `POST /whatsapp/webhook` (di bawah global prefix → `/api/v1/whatsapp/webhook`, cocok dgn start-gowa.cmd): verify → dedup → serahkan ke ConversationService (M4) → selalu 200.
**Tests:** HMAC valid/invalid/absen · dedup dobel · parse DM vs grup fixture (payload dari notes-gowa).
**Verify:** `scripts/fake-webhook.mjs` (create — hitung HMAC & POST payload contoh) → api log balasan masuk outbox. Commit.

## M3 — Agent kopra: tools ber-gate + system prompt (apps/agent/)

**Files:** `src/mastra/tools/{read-tools.ts, write-tools.ts, rag-tool.ts}`, update `agents/kopra.ts` (attach tools, instructions final), `src/lib/context.ts` (tipe `ActorContext {actorId?, koperasiId?, role, channel, koperasiNama?}` — dikirim api via `runtimeContext` Mastra).

- Read tools (semua cek `core.policy.can` dulu, lempar pesan penolakan sopan): `getCooperativeProfile`, `listCoaAccounts`, `listJournalEntries`, `getFinancialDashboard` (agregat journal_lines), `listProducts`, `getStockLevels`, `getStockCard`, `getMySavings`, `listUnpaidMembers`, `generateFinancialReport` (return URL laporan api).
- Write-draft tools (role PENGURUS/OWNER + channel DM only): `createEntryDraft(SimpleEntryInput)`, `recordStockMovementDraft`, `paySavingDraft`, `createProductDraft` — semuanya → `core.*Draft` + `core.createPending` + return preview text (bot menampilkan + "Balas YA untuk simpan / BATAL").
- `rag-tool.ts` — `searchCooperativeGuidance(query)` → FTS (M5).
- Instructions kopra: persona pendamping, tak berhitung, arahkan aksi grup→DM, jawab ringkas, sebut sumber utk jawaban panduan.
**Verify:** `pnpm dev:agent` → playground: tanya profil koperasi (ctx pengurus demo) → jawaban benar; coba write tool dgn ctx role ANGGOTA → ditolak. Commit.

## M4 — Conversation orchestrator DM (state machine deterministik)

**Files:** `apps/api/src/whatsapp/conversation.service.ts` + `conversation.spec.ts`; `agent-client.ts` (panggil Mastra server `POST http://localhost:4111/api/agents/kopra/generate` dgn `runtimeContext`).

```
onMessage(m):
  if m.isGroup → M7
  identity = whatsapp_identities.findUnique(m.senderNumber)
  if !identity → guestFlow(m)            // M6; sementara M4: intro + RAG-only ctx GUEST
  pending = core.getAwaiting(m.chatJid)
  if pending:
     "YA|ya|y|iya" → core.confirmPending → balas sukses + saldo kas (query)
     "BATAL|batal|gajadi" → cancel → balas dibatalkan
     else → agent dgn konteks pending.preview (revisi) → update draft+preview → tampilkan ulang
  else → agent.generate(m.text, ctx dari identity) → balas
  semua balasan via outbox; audit tiap langkah
```
**Tests:** 4 cabang di atas + anggota tanya keuangan DM (boleh — transparansi) + guest tanya publik.
**Verify end-to-end TANPA HP:** `node scripts/fake-webhook.mjs --text "catat pemasukan banyu 500rb dari penjualan air galon" --from 62811111` (nomor pengurus demo di-link dulu via seed kecil `whatsapp_identities`) → cek jurnal DRAFT muncul (psql) → fake-webhook "YA" → CONFIRMED + outbox berisi balasan sukses. **Ini checkpoint demo inti.** Commit + merge ke main.

## M5 — RAG FTS P1 (ingest + tool)

**Files:** `apps/agent/src/rag/ingest.ts` (atau `packages/db/src/ingest-rag.ts` agar dekat prisma — pilih db); script `pnpm --filter @kopra/db ingest:rag`; korpus: tulis 3 file baru `rag_corpus/panduan-pembukuan-{klasifikasi,jurnal-sederhana,laporan}.md`, salin/refer `docs/data/kdmp-modules-tutorial/*.md` (sourceType `module_tutorial`), transkrip interview + berkas anonim (`field_research`), file existing `uu-25-1992-perkoperasian.md`, `faq-kdmp.md`, `template-laporan-rat.md`, `raw/lpj-rat-…-transkrip.md`.
- Ingest: chunk ±800 kata overlap 100 per heading → insert `rag_documents` (title = file+heading, source, sourceType) — idempotent (hapus per-source lalu re-insert).
- Query: `SELECT …, ts_rank(tsv, plainto_tsquery('simple', $q)) rank FROM rag_documents WHERE tsv @@ plainto_tsquery('simple',$q) ORDER BY rank DESC LIMIT 5` (+fallback ILIKE bila 0 hasil).
**Verify:** "beli stok air masuk operasional atau persediaan?" → jawaban menyebut PERSEDIAAN + sumber panduan; "cara pakai aplikasi CORE" → dari module_tutorial; "syarat RAT menurut UU" → kutip pasal. Commit.

## M6 — Guest flow + registrasi sisi-WA + super-admin (Fase 3 bot)

**Files:** `apps/api/src/registration/{registration.module,tokens.service,registration.service,registration.controller}.ts` + spec (NIK-match TDD: kasus match→ACTIVE+memberId / no-match→PENDING / member-created-later hook / OTP salah 3× / expiry); `apps/api/src/whatsapp/{guest-flow.ts, super-admin.ts}` + spec (parser deterministik `PERMOHONAN|DETAIL|SETUJUI|TOLAK|PERAN`, hanya dari `SUPER_ADMIN_WA_NUMBER`).
- Guest flow state (simpan step di tabel kecil `wa_runs`? → gunakan `AuthToken.payload` + pending Reg — TIDAK: simpan step ringan di `RegistrationRequest.status AWAITING_FORM` + cache in-memory per chatJid utk step tanya role/koperasi; restart-safe cukup via "ketik DAFTAR ulang").
- Magic link `${APP_PUBLIC_WEB_URL}/register/complete?token=…` (halaman web = Aldio; kontrak: `POST /api/v1/registration/complete-wa {token,nama,nik,password}` — endpoint dibuat di sini, UI menyusul).
- OTP: issue+hash+3 attempts; kirim via outbox DM.
- Notifikasi pengurus/pemohon via outbox.
**Verify:** fake-webhook "DAFTAR" → bot tanya role → koperasi search top-5 → link keluar di outbox; curl complete-wa (NIK match member seed ber-NIK) → ACTIVE + notifikasi; NIK asing → PENDING → fake-webhook super-admin `SETUJUI R-001` → ACTIVE. Commit + merge main.

## M7 — Group support (Fase 4)

**Files:** `apps/api/src/whatsapp/group.service.ts` + spec.
- Upsert WaGroup on group message; resolution via `getGroupParticipants` → identities ACTIVE → 1 koperasi = ATTACHED (umumkan via outbox); 0/multi = UNRESOLVED (tanya saat mention; jawaban hanya diterima dari user terdaftar utk koperasinya sendiri, prioritas PENGURUS).
- Semua pesan grup → `WaGroupMessage` (prune 50/24h); non-mention = simpan saja; mention (`@Kopra` / `@<nomorBot>` di body — fallback deterministik per notes-gowa) → agent ctx GROUP + 20 pesan konteks; read per matriks (finance-read grup = PENGURUS/OWNER; write → tolak sopan arahkan DM, TANPA PendingAction).
**Verify:** fake-webhook grup 3 skenario (bind otomatis, tanya-bind, mention read/write). Setelah pairing HP: uji grup nyata. Commit + merge main.

---

## Detail interaksi WhatsApp

Skrip verbatim seluruh flow (F0, DAFTAR, SUPERADMIN, F1–F5, F7, GRUP) + aturan copywriting: **[wa-interaction-flows.md](wa-interaction-flows.md)** — jadi acuan copywriting bot dan test fixtures.

## Koordinasi dgn Aldio
- `packages/core` M1 = juga fondasi api Aldio (accounting service memakai core) — merge M1 ke `main` SEGERA setelah hijau supaya Aldio bisa pakai.
- Kontrak yang Aldio konsumsi dari workstream ini: endpoint `POST /api/v1/registration/complete-wa`, `GET /api/v1/registration/koperasi?q=`, halaman `/register/complete?token=` (UI dia), `GET /reports/*` URL dipakai `generateFinancialReport`.
- Merge ke `main` per milestone (M1, M4, M6, M7 minimal), `git pull --rebase origin main` dulu.

## Verifikasi keseluruhan (acceptance workstream)
1. `pnpm --filter @kopra/core test` + `--filter api test` hijau (policy, posting, pending, HMAC, dedup, NIK-match, super-admin parser, group binding).
2. Tanpa HP: rangkaian fake-webhook penuh — guest intro → DAFTAR → …ACTIVE → "catat pemasukan banyu 500rb" → preview → YA → jurnal CONFIRMED (psql) → "stok minyakita berapa?" → jawaban → grup bind + mention.
3. Dengan HP (setelah pairing manusia): ulangi jalur inti dari WhatsApp nyata; duplicate YA tidak dobel.
4. Semua commit di `development/dika`, merge milestone ke `main`, tanpa Co-Authored-By, scan kredensial sebelum tiap push.
