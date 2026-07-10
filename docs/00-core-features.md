# KOPRA — Spec Final & Rencana Implementasi (v2, LOCKED)

**Update:** 10 Jul 2026 (pasca riset DB panitia + re-plan inventaris) · **Pilar:** 4 · **Tim:** Fandelion
**Ini SATU-SATUNYA dokumen scope.** Dokumen lain (01–03, riset-lapangan/) adalah konteks pendukung. Kalau ragu sebuah fitur perlu dibangun: cari di §9 (CUT & Backlog). Kalau tetap ragu → tanya grup, default JANGAN bangun.

---

## 0. Tesis produk & bukti

> **Kopra = antarmuka WhatsApp untuk CRUD harian koperasi** (transaksi, stok, simpanan) di atas struktur data yang se-shape dengan SIMKOPDES. Fitur di sistem resmi sudah ada — yang gagal adalah **input harian**, karena interface-nya bukan tempat pengurus bekerja. Webapp Kopra = layar untuk melihat & laporan; WhatsApp = tangan untuk mengisi.

Bukti (semua dari data resmi panitia + riset lapangan sendiri — siap disitasi di pitch):

| Klaim | Angka | Sumber |
|---|---|---|
| Akses ada, aktivasi mati | 92% KDMP punya akun SIMKOPDES; <1% aktif kirim proposal bisnis; transaksi tercatat cuma 1.000 row | Kemenkop/SIMKOPDES |
| Setup jalan, input harian mati | **640/1.026 koperasi daftar 13.974 produk, tapi hanya 301 (29%) pernah catat barang masuk/keluar** | DB panitia |
| Kenapa: SDM & pelatihan | Umur pengurus **median 44 th** (49% ≥45); pelatihan SaaS tidak ada | DB panitia + interview |
| Simpanan = pain keuangan #1 | 61% record simpanan UNPAID (226.912); 76% anggota tanpa akun | DB panitia |
| WhatsApp = platform kerja nyata | Pemesanan mitra, penagihan simpanan, koordinasi — semua via WA | Interview Bu Anita & Pak Tedjo |
| Inventaris BERGUNA bila accessible | Bu Anita: stock opname & fast-moving "sangat membantu" — via app vendor custom | Interview §73–75 |

Prinsip non-negotiable: **LLM explains, backend calculates.** Angka selalu dari SQL; commit data = kode deterministik setelah user balas "YA"; LLM hanya ekstraksi intent + merangkai kalimat.

---

## 1. Arsitektur & stack (LOCKED — jangan dibuka ulang)

```
REPO kopra-simkopdes (disubmit):
  apps/web    Next.js   — dashboard ERP, chat asisten, landing, learning-path
  apps/api    NestJS    — auth/JWT, CRUD, laporan, webhook WAHA, audit
  apps/agent  Mastra    — agent kopra, workflow suspend/resume, memory, RAG
                          (`mastra dev` = playground test tanpa WA)
  packages/db Prisma    — schema+client (dipakai api & agent)
REPO kopra-whatsapp-waha: container WAHA + volume session + panduan pairing

Alur : WAHA → api /wa/webhook (identity+guardrail) → agent → api → WAHA
       web chat → agent langsung (streaming, JWT dari api)
Infra: 1 VPS GCP asia-southeast2 (credit $60 panitia), docker-compose
       [web, api, agent, postgres(pgvector)] + waha di repo infra
LLM  : claude-opus-4-8 (agent + OCR vision) · STT: Whisper Groq (2b)
```

Sudah diputuskan & ditolak: Dify, LangChain/LangGraph, FastAPI, Next.js-only, WAHA di monorepo. Alasan terdokumentasi di history diskusi — jangan re-litigasi jam 3 pagi.

---

## 2. Data model (Prisma — 14 model, SUDAH ditulis di packages/db)

```
users                   email, passwordHash, name, role PENGURUS|ANGGOTA
koperasi                nama, desa, sourceRef → profil_koperasi panitia
whatsapp_identities     waNumber UNIQUE → userId, koperasiId
members                 nama, waNumber?, simpananWajibLunas, sourceRef
business_units          nama (BRILINK, POSPAY, BANEW, GERAI, MITRA SPPG, AGRO MANDIRI)
accounts                type KAS|BANK
transaction_categories  nama, klass OPERASIONAL|PERSEDIAAN|INVESTASI|MODAL|PENDAPATAN
transactions            date, type INCOME|EXPENSE|TRANSFER, amount, description,
                        businessUnitId?, accountId, categoryId,
                        sourceChannel WHATSAPP|WEB|SEED|IMPORT, status DRAFT|CONFIRMED
products                nama, unit?, barcode?, hargaJual?, sourceRef → produk_koperasi
stock_movements         productId, type IN|OUT|ADJUST, qty, hargaBeli?, hargaJual?,
                        transactionId? (1-1 link transaksi uang), sourceChannel, status
rag_documents           title, source, sourceType, content, embedding vector(1024)
audit_logs              koperasiId?, actorId?, action, payloadJson
(course_modules, course_progress → BACKLOG, jangan dibuat sekarang)
```

Aturan: **stok terkini = SUM movement CONFIRMED** (query, bukan kolom). Simpanan per periode meniru `simpanan_anggota` panitia (periode + status PAID/UNPAID) — implement via tabel `member_savings(memberId, period "2026-01", amount, status)` ← tambahkan model ini saat implementasi seed (total jadi 15).

---

## 3. Fitur MVP

### 3.1 ERP Webapp (role PENGURUS) — layar untuk melihat
| Fitur | Detail |
|---|---|
| Dashboard | Cards: Saldo Kas, Saldo Bank, Pemasukan & Pengeluaran bulan ini, SHU sementara, anggota nunggak; tabel performa per unit usaha |
| Ledger | list transaksi + filter (bulan/unit/status/source), input manual, edit & confirm DRAFT, badge sumber WA/Web |
| **Produk & Stok** | list produk (import dari data resmi) + stok terkini + kartu stok per produk (riwayat movement). TANPA kasir/barcode-scan |
| Anggota & Simpanan | list anggota + status simpanan **per periode** (PAID/UNPAID), dukung bayar rapel multi-bulan |
| Laporan | **Buku Kas** & **Laba Rugi** per bulan, print-friendly, **kolom meniru Excel asli Palbapang** (`No|Tanggal|Uraian|Bukti|Debet|Kredit|Saldo|Ket`) — framing "siap RAT" |

### 3.2 WhatsApp Assistant — tangan untuk mengisi (WEDGE)
**Fase 2a (teks, fondasi):** catat transaksi · catat stok masuk/keluar (penjualan auto-bikin transaksi pemasukan) · tanya stok/keuangan · tanya panduan (RAG) · daftar penunggak + template pengingat · minta laporan.
**Fase 2b (stretch, urutan):** OCR nota (Claude vision; nota belanja → stok masuk + transaksi keluar sekaligus) → catat pembayaran simpanan (rapel) → voice note (Whisper).
Detail flows di §5.

### 3.3 Webapp umum
Login credentials sederhana (2 role) · chat asisten di dashboard (otak & tools sama dengan WA, streaming) · landing 1 halaman · **halaman Learning Path statis** (artefak Pilar 4; course interaktif = backlog).

### 3.4 RAG
Ingest: markdown → chunk → embed → pgvector; sourceType `regulation|guide|field_research|template`.
P1 (wajib): panduan pembukuan praktis (klasifikasi transaksi!), konsep koperasi (simpanan/SHU/RAT), catatan lapangan (tag field_research).
P2: UU 25/1992 pasal inti, Inpres 9/2025, panduan/FAQ resmi KDMP.
P3 (opsional): template dokumen (undangan RAT, laporan pengurus, reminder).
Aturan jawab: tak mengarang pasal; bedakan regulasi vs praktik vs temuan lapangan; bahasa sederhana; kasus sensitif → caveat.

### 3.5 Import data resmi (fitur demo)
`import-koperasi.ts --ref KOP-XXXX`: tarik dari mirror lokal DB panitia → profil, anggota, pengurus→users, simpanan per periode (PAID/UNPAID asli), **produk** → tabel Kopra. Pitch: "onboarding koperasi dari data resmi dalam satu perintah". Seed transaksi harian tetap sintetis pakai **kosakata & nominal asli** (`riset-lapangan/berkas-lapangan-anonim.md`).

---

## 4. Kontrak API (apps/api, REST, JWT, semua scoped koperasiId)

| Area | Endpoint | Catatan |
|---|---|---|
| Auth | `POST /auth/login` · `GET /auth/me` | JWT berisi userId, koperasiId, role |
| Members | `GET /members?unpaid=&search=` · `POST /members` · `PATCH /members/:id` | |
| Simpanan | `GET /members/:id/simpanan` · `POST /members/:id/simpanan/pay {periods[], amount}` | rapel multi-bulan |
| Units/Accounts/Categories | `GET/POST /business-units` · `GET /accounts` · `GET /categories` | accounts & categories dari seed |
| Transactions | `GET /transactions?month=&unitId=&status=&source=` · `POST /transactions` · `PATCH /transactions/:id` (DRAFT saja) · `POST /transactions/:id/confirm` · `DELETE /transactions/:id` (DRAFT saja) | CONFIRMED immutable — koreksi via jurnal balik (jawaban juri) |
| **Products** | `GET/POST /products` · `PATCH /products/:id` · `GET /products/:id/card` (stok + riwayat) | |
| **Stock** | `GET /stock-movements?productId=` · `POST /stock-movements` · `POST /stock-movements/:id/confirm` | movement CONFIRMED immutable; confirm movement ber-link transaksi = confirm dua-duanya atomik |
| Reports | `GET /dashboard/summary` · `GET /reports/buku-kas?month=&format=html` · `GET /reports/laba-rugi?month=&format=html` | satu endpoint summary, SQL agregat |
| WA/Admin | `GET/POST/DELETE /wa-identities` · `POST /wa/webhook` (auth api-key WAHA) · `POST /admin/import-koperasi {sourceRef}` · `GET /audit-logs` | |

Tidak dibangun: delete anggota, user management UI, CRUD kategori penuh, edit transaksi confirmed.

---

## 5. WhatsApp Agent — state machine & flows

### State per chat (deterministik, DI LUAR LLM)
```
IDLE ──draft dibuat──► AWAITING_CONFIRMATION(draftId)
  "YA/ya/y"        → confirm (kode) → balas sukses → IDLE
  "batal/gajadi"   → hapus draft → IDLE
  teks koreksi     → agent revisi draft → kirim ulang konfirmasi
  pertanyaan lain  → dijawab, draft tetap pending (bot ingatkan)
Implementasi: Mastra workflow suspended = AWAITING; webhook cek suspended-run
per chat dulu, baru panggil agent bebas. SATU draft pending per chat.
```

### Flows
**F0 Nomor asing** → perkenalan + cara minta pengurus menautkan nomor di web. Nol akses data.

**F1 Catat transaksi (JALUR DEMO UTAMA)**
`"catat pemasukan banyu 500rb dari penjualan air galon"` → ekstrak → `createTransactionDraft` (validasi unit+kategori) → SUSPEND → bot: "📝 Draft: Pemasukan • BANEW • Rp500.000 … Balas YA" → "YA" → confirm (kode) → "✅ Tersimpan. Saldo kas Rp… <link>" → muncul real-time di web (badge WhatsApp). Cabang: koreksi ("eh 450rb") / batal.
Parser WAJIB dites kosakata asli: "terima simpanan wajib an Bu X juli-des", "bagi hasil pisang 150rb", "laba brilink", "belanja banew ke-2".

**F2 Tanya keuangan** → `getFinancialSummary` (SQL: total, per unit, MoM growth) → jawaban berangka-query.

**F3 Tanya panduan (RAG)** → `searchKoperasiGuides` → jawaban + sumber; temuan lapangan diframe "dari temuan lapangan…".

**F4 Simpanan & penunggak** → `listUnpaidMembers` → daftar + total → tawarkan template pengingat (bot kirim TEKS untuk di-copy pengurus — **tidak pernah auto-broadcast ke anggota**). (2b) `"catat bu Sari bayar simpanan jan-mar 150rb"` → draft 3 periode → YA → PAID.

**F5 Minta laporan** → `generateReport` → link buku kas / laba rugi bulan diminta.

**F6 (2b) Media** → foto nota: download → Claude vision → draft (belanja stok = movement IN + transaksi EXPENSE sekaligus). Voice: Whisper → teks → flow sesuai isi.

**F7 Stok (Fase 2a — bagian tesis inti)**
- `"stok masuk minyakita 20 pcs, beli 14rb"` → draft movement IN (+opsional transaksi EXPENSE linked) → YA → stok naik
- `"kejual minyakita 5"` → draft movement OUT **+ otomatis draft transaksi INCOME** (5 × hargaJual) → SATU konfirmasi YA → dua record CONFIRMED atomik → *momen demo: stok & kas berubah bersamaan di web*
- `"stok minyakita berapa?"` / `"barang apa yang mau habis?"` → `getStockLevels`
- Produk tak dikenal → bot tawarkan buat produk baru (draft) — C dari CRUD products via WA

### Guardrails lintas-flow
Nomor asing = nol akses · semua query/write scoped koperasiId · semua tool call → audit_logs · angka selalu hasil query · error tool → minta klarifikasi, jangan menebak · bahasa Indonesia santai-sopan ala pendamping · Memory = Mastra thread per nomor WA.

---

## 6. Agent & tools (apps/agent — Mastra, 7 tools)

| Tool | Isi (fungsi TS + Prisma, deterministik) |
|---|---|
| `createTransactionDraft` | validasi unit & kategori → insert DRAFT → ringkasan |
| `recordStockMovement` | validasi produk (fuzzy match nama) → draft IN/OUT (+draft transaksi linked utk penjualan/belanja) |
| `getStockLevels` | SUM movement per produk; filter "hampir habis" (threshold qty ≤ 5) |
| `getFinancialSummary` | SQL agregat bulan/unit + MoM growth |
| `listUnpaidMembers` | simpanan UNPAID per member + total |
| `generateReport` | URL laporan bulan diminta |
| `searchKoperasiGuides` | vector search pgvector → chunks + sumber |

Workflow `recordEntry` (dipakai F1 & F7): parseDraft → `.suspend()` (kirim konfirmasi WA; state di Postgres, tahan restart) → resume("YA") = confirm atomik / resume(lain) = revisi-batal.
Agent `kopra`: model `claude-opus-4-8`, system prompt bahasa sederhana, tak pernah menghitung angka sendiri, tak pernah menulis DB langsung.

---

## 7. FASE IMPLEMENTASI (final)

### Fase 0 — Prep (SEKARANG, sebelum/awal sprint)
- [ ] Scaffold 3 app: `create-next-app`, `nest new`, `create mastra` (+`npx skills add mastra-ai/skills`)
- [ ] `docker compose up postgres` → `prisma db push` (schema §2, +model member_savings)
- [ ] `seed.ts` (kosakata asli) + `import-koperasi.ts` (termasuk produk)
- [ ] WAHA: pairing nomor burner (repo infra), tes webhook lokal
- [ ] Kumpulkan korpus RAG P1–P2 → `rag_corpus/`
- [ ] GCP: ganti password default, provision VPS asia-southeast2, docker compose up kosong
- **Done:** webapp kosong live di VPS, WA terhubung, DB terisi seed+import

### Fase 1 — ERP core (jam 0–8) · Dev 1 fokus di sini
- [ ] apps/api: auth, members+simpanan, units, transactions, products+stock, reports, dashboard (kontrak §4)
- [ ] apps/web: login, dashboard, ledger, produk+kartu stok, anggota+simpanan, laporan print
- **Done:** juri bisa lihat webapp hidup dengan data nyata (anggota/simpanan/produk resmi + transaksi seed)

### Fase 2a — WA teks (jam 8–16) · Dev 2 mulai paralel dari Fase 0
- [ ] webhook + identity + state machine §5
- [ ] agent + 7 tools + workflow suspend/resume
- [ ] RAG ingest P1 + tool search
- [ ] Flows F0–F5, F7 jalan end-to-end
- **Done:** demo WA→ledger→stok→laporan end-to-end di device asli

### Fase 2b — Stretch (jam 16–20, urutan potong terbalik)
- [ ] OCR nota → [ ] simpanan via WA → [ ] STT voice
- **Done per item:** flow media/simpanan masuk draft→YA yang sama

### Fase 3 — Web chat + polish (jam 20–28)
- [ ] chat asisten dashboard (streaming, tools sama) · [ ] landing · [ ] learning path statis · [ ] RAG P2
- **Done:** semua halaman demo-ready

### Fase 4 — Hardening & pitch (jam 28–36)
- [ ] polish UI + seed final · [ ] **rekam video demo 3 menit** (asuransi WAHA) · [ ] deck ≤12 slide (statistik §0) · [ ] submit: repo publik + README + link demo + kredensial juri + video · [ ] latihan pitch + disclosure AI
- **Done:** submission lengkap SEBELUM deadline

### Aturan potong scope (urutan korban kalau kepepet)
`RAG P3 → STT → simpanan-via-WA (2b) → OCR → halaman learning path → should-have ERP`
**Tidak pernah dikorbankan:** F1+F7 (transaksi & stok via WA + konfirmasi YA), dashboard+laporan, RAG P1, import data resmi.

---

## 8. Should-have (hanya kalau semua fase selesai cepat)
Buku Bank · Neraca sederhana · Export Excel · upload bukti transaksi · evals Mastra untuk RAG.

## 9. CUT & BACKLOG (jawaban juri disiapkan)
**CUT (tidak dibangun, punya jawaban):**
- **POS/kasir checkout, barcode scanning, harga promo** — segmen yang butuh kasir sudah dilayani vendor (kasus Bangunharjo); target Kopra = 700+ koperasi tanpa app vendor; stok kami movement-log via WA, bukan point-of-sale
- Payment gateway, approval berjenjang, multi-koperasi UI, delete anggota, user mgmt UI
**BACKLOG (slide roadmap):** course interaktif Gen Z + gamifikasi · integrasi API SIMKOPDES/Satriya (schema sudah se-shape) · MCP server tool layer · Excel import · stock opname massal · HPP/FIFO · SHU simulation · WhatsApp Business API resmi.

## 10. Demo script 5 menit
1. **Hook (30s):** 92% akun vs <1% aktif; 640 daftar produk vs 301 yang mencatat; pengurus median 44 th — "masalahnya bukan aplikasi; input hariannya yang mati"
2. **WA (2m):** "catat pemasukan banyu 500rb" → YA → muncul di web · **"kejual minyakita 5" → YA → stok & kas berubah bersamaan** ("dua buku tercatat sekali chat") · (kalau 2b jadi: foto nota / voice)
3. **Web (1m):** dashboard → kartu stok → laporan Laba Rugi print-ready "siap RAT"
4. **RAG (30s):** "beli stok air masuk operasional atau persediaan?" → jawaban + sumber
5. **Closing (1m):** import 1 koperasi dari data resmi live → learning path (Pilar 4: Gen Z agen digitalisasi) → roadmap (integrasi SIMKOPDES — "schema kami sudah se-shape") → dampak

## 11. Compliance TOR
Repo publik + README (install + arsitektur) · deck PDF ≤12 slide · link demo aktif + **kredensial akun uji juri** · video ≤3 menit unlisted · **disclosure AI** (Claude Code/Codex = coding assistance; ide & riset lapangan = orisinal tim) · HAKI → Kemenkop bila Top 10 · **tak ada kredensial/PII bocor di repo**.
