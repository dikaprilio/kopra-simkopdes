# Kopra — Core Features Spec (Sprint 24–36 Jam)

**Tanggal:** 2026-07-10 · **Status:** LOCKED untuk sprint · **Pilar:** 4 (Literasi Gen-Z, diframe sebagai bridge ke aktivasi)
**Dokumen kerja untuk Claude Code / Codex selama sprint. Kalau ragu scope: baca bagian CUT-LIST & prinsip di bawah.**

---

## 0. Narasi produk (untuk konteks semua fitur)

> 92% Kopdes Merah Putih punya akun SIMKOPDES, tapi <1% yang aktif memakainya untuk bisnis. Masalahnya bukan ketiadaan aplikasi — pengurus tetap kerja di WhatsApp dan Excel. **Kopra bertemu pengurus di tempat mereka berada (WhatsApp), mengubah kebiasaan chat jadi pembukuan terstruktur, dan menyiapkan Gen Z sebagai agen digitalisasi desa.**

Persona utama: **Pak Tedjo** (Wakil Ketua Bidang Usaha KDMP Palbapang, Excel-first, pain = klasifikasi & laporan keuangan).
Prinsip non-negotiable: **LLM explains, backend calculates.** Semua angka dari query SQL; LLM hanya ekstraksi intent & merangkai kalimat. Commit transaksi final = kode deterministik (workflow step), bukan keputusan LLM.

---

## 1. Arsitektur & stack (LOCKED)

```
REPO 1 — kopra (monorepo pnpm, INI yang disubmit ke juri):
  apps/web    → Next.js (frontend murni: dashboard ERP, chat asisten, landing, learning-path page)
  apps/api    → NestJS (auth/JWT, CRUD, laporan, webhook WAHA di module whatsapp/, audit log)
  apps/agent  → Mastra server standalone (agent kopra, workflow suspend/resume, memory, RAG)
                `mastra dev` = playground lokal untuk test agent tanpa WA
  packages/db → Prisma schema + client (dipakai apps/api & apps/agent)
  docker-compose.yml → web, api, agent, postgres(pgvector)

REPO 2 — kopra-infra (repo pendamping, disebut di README repo 1):
  docker-compose.yml → waha (volume waha_sessions — WAJIB, biar pairing QR
                       tidak hilang saat restart), network, script deploy VPS

Alur: WAHA → api (identity+guardrail) → agent (Mastra API) → api → WAHA
      web chat → agent langsung (streaming, JWT dari api diverifikasi middleware Mastra)

Infra: 1 VPS (GCP asia-southeast2, pakai credit $60 panitia), 5 container total
LLM: Claude API — claude-opus-4-8 (agent utama & OCR vision)
STT: Whisper via Groq/OpenRouter (Fase 2b)
Repo: npx skills add mastra-ai/skills (supaya coding agents akurat menulis Mastra)
```

Keputusan yang sudah diperdebatkan & dikunci (jangan dibuka lagi saat sprint):
- ❌ Dify (GUI, tak bisa diedit coding agents, self-host berat)
- ❌ LangChain/LangGraph (kekuatannya di Python; backend kita TS)
- ❌ FastAPI/Python service (bahasa kedua = konteks terbelah)
- ❌ Next.js-only (butuh backend terpisah yang proper) → NestJS
- ✅ Mastra dipilih karena: workflow suspend/resume durable (konfirmasi YA), memory first-class, RAG built-in, evals, Mastra Skills untuk coding agents

---

## 2. ERP (webapp, role: PENGURUS)

### Must-have
| Fitur | Detail |
|---|---|
| Dashboard | Cards: Saldo Kas, Saldo Bank, Pemasukan bulan ini, Pengeluaran bulan ini, SHU sementara, Anggota belum bayar simpanan wajib. + bar/tabel performa per unit usaha |
| Ledger transaksi | List + filter (bulan, unit usaha, status), input manual, edit draft. Status: DRAFT / CONFIRMED. Badge sumber: WhatsApp/Web |
| Unit usaha | List (BRILINK, POSPAY, BANEW, GERAI, MITRA SPPG, AGRO MANDIRI) + ringkasan pemasukan/pengeluaran/net per unit |
| Anggota | List + status simpanan wajib (lunas/belum) |
| Laporan | **Buku Kas** & **Laba Rugi** per bulan, tampilan print-friendly + tombol print |

### Should-have (hanya kalau Fase 1–3 selesai lebih cepat)
Buku Bank · Neraca sederhana · Export Excel · Upload bukti transaksi

### CUT (jangan dibangun, jawaban siap untuk juri)
- **Inventory/stok** — bukti lapangan: Excel Pak Tedjo tidak punya sheet stok (pain-nya klasifikasi & laporan); Bu Anita sudah punya POS vendor. Kebutuhan stok tercakup lewat kategori transaksi "Persediaan".
- POS/barcode, payment gateway, approval berjenjang, multi-koperasi UI, integrasi SIMKOPDES (masuk slide roadmap).

---

## 3. WhatsApp Assistant (WEDGE UTAMA)

### Fase 2a — teks (fondasi, wajib stabil dulu)
| Capability | Flow |
|---|---|
| Catat transaksi | "catat pemasukan banyu 500rb dari penjualan air" → agent ekstrak → tool `createTransactionDraft` (validasi unit & kategori) → **workflow suspend** → bot balas draft "📝 …Balas YA untuk simpan" → user "YA" → **resume**: UPDATE status CONFIRMED (kode biasa) → muncul real-time di webapp. Balasan selain YA → koreksi/batal |
| Ringkasan keuangan | "pemasukan bulan ini berapa, naik ga dari bulan lalu?" → tool `getFinancialSummary` (SQL agregat: per bulan, per unit, growth %) → LLM jelaskan angka hasil query |
| Panduan koperasi (RAG) | "beli stok air masuk operasional atau persediaan?" → tool `searchKoperasiGuides` → jawab dengan sumber |
| Anggota belum bayar | "siapa yang belum bayar simpanan wajib?" → tool `listUnpaidMembers` + tawarkan template pengingat |
| Minta laporan | "kirim laporan buku kas juni" → tool `generateReport` → bot kirim link |

### Fase 2b — media (stretch, plumbing dibangun sekali)
- **OCR nota** (prioritas 1): foto nota → download media WAHA → Claude vision ekstrak → draft transaksi → konfirmasi YA. Tanpa vendor tambahan.
- **Voice note / STT** (prioritas 2): audio → Whisper (Groq/OpenRouter) → teks → pipeline yang sama.

### Guardrails
- Nomor tak terdaftar → balas instruksi pendaftaran, tidak bisa akses data
- Semua query/write dibatasi `koperasiId` milik user (dari `whatsapp_identities`)
- Semua tool call → `audit_logs`
- Memory: Mastra Memory, thread per nomor WA

---

## 4. Webapp umum

- **Login sederhana**: email+password (NextAuth credentials), 2 role: PENGURUS / ANGGOTA. Tanpa OAuth, tanpa verifikasi email.
- **Chat asisten di dashboard**: agent & tools yang SAMA dengan WA bot, streaming. Selling point: "satu otak, dua pintu".
- **Landing page**: 1 halaman — masalah (92% vs <1%), solusi 3 poin, CTA demo.
- **Halaman "Learning Path" (statis, ~1 jam)**: menampilkan path "Jadi Agen Digitalisasi Desa" + modul-modul sebagai roadmap terkunci + narasi Gen Z agen digitalisasi. **Artefak Pilar 4 di demo** — course interaktifnya sendiri ada di BACKLOG.

---

## 5. RAG Knowledge Base

Ingest script: markdown/PDF → chunk → embed → pgvector (`rag_documents`), metadata: title, source, sourceType (`regulation` | `guide` | `field_research` | `template`).

**P1 (wajib saat demo):**
1. Panduan pembukuan praktis: buku kas, klasifikasi transaksi (operasional/persediaan/investasi/modal/pendapatan), laba rugi & neraca sederhana
2. Konsep koperasi: simpanan pokok vs wajib, SHU, hak anggota, tugas pengurus/pengawas, RAT
3. Catatan lapangan: interview Bu Anita & Pak Tedjo + struktur Excel Palbapang → tag `field_research` (jawaban harus dibedakan dari regulasi: "dari temuan lapangan…")

**P2 (target sebelum/awal sprint):**
4. UU 25/1992 Perkoperasian (pasal inti), Inpres 9/2025 KDMP, panduan/FAQ resmi Kopdes Merah Putih
5. Aturan simpanan, SHU, RAT

**P3 (kalau sempat):** template dokumen (undangan RAT, laporan pengurus, reminder simpanan wajib)

Aturan jawaban: tidak mengarang pasal; bedakan regulasi vs praktik umum vs temuan lapangan; bahasa Indonesia sederhana; kasus sensitif akuntansi/hukum → beri caveat.

---

## 6. Data model (Prisma, 12 tabel)

```
users(id, email, passwordHash, name, role: PENGURUS|ANGGOTA)
koperasi(id, nama, desa)
whatsapp_identities(id, userId, koperasiId, waNumber)
members(id, koperasiId, nama, waNumber?, simpananWajibLunas: bool)
business_units(id, koperasiId, nama)
accounts(id, koperasiId, type: KAS|BANK)
transactions(id, koperasiId, businessUnitId, accountId, date,
             type: INCOME|EXPENSE|TRANSFER, categoryId, description, amount,
             sourceChannel: WHATSAPP|WEB|SEED, status: DRAFT|CONFIRMED, createdById)
transaction_categories(id, nama, klass: OPERASIONAL|PERSEDIAAN|INVESTASI|MODAL|PENDAPATAN)
rag_documents(id, title, source, sourceType, content, embedding vector)
audit_logs(id, koperasiId, actorId, action, payloadJson, createdAt)
-- backlog-ready (buat tabelnya nanti saja, JANGAN sekarang):
-- course_modules, course_progress
```

### Sumber data resmi panitia (shared DB — diverifikasi 10 Jul)

Panitia menyediakan Postgres shared (host di email panitia, kredensial di `.env` — **JANGAN commit ke repo, repo akan publik!**). Status hasil audit:
- **READ-ONLY** (CREATE TABLE ditolak — instruksi "table prefix" di email tidak berlaku selama write belum dibuka; kalau dibuka belakangan, prefix `fandelion_`)
- pgvector TERSEDIA tapi tidak terinstall & tak bisa kita install → RAG tetap di Postgres kita sendiri
- 27 tabel terisi: 1.026 koperasi (profil+wilayah+desa), 74.269 anggota, 372.407 simpanan (**226.912 UNPAID = 61%** ← amunisi fitur & pitch), 8.482 pengurus, 13.974 produk/inventaris, referensi komoditas & profil desa, transaksi penjualan hanya 1.000 row di 418 koperasi (Des 2025–Jul 2026) → bukti activation gap ada di data resmi sendiri

**Strategi:** app DB tetap Postgres sendiri (docker-compose). Tambah **script import**: pilih 1 koperasi nyata dari shared DB → tarik profil, anggota, pengurus, simpanan (status PAID/UNPAID asli) ke DB Kopra → demo "onboarding koperasi dari data resmi dalam satu perintah". `listUnpaidMembers` & dashboard jalan di data resmi. Transaksi operasional harian tetap di-seed ala Excel Pak Tedjo (data resmi tipis di sisi ini — dan itu justru poin pitch kami).

**Seed lokal (fallback & pelengkap)**: 6 unit usaha ala Palbapang, ~2 bulan transaksi realistis, kategori standar, 2 user demo. Dashboard & laporan harus hidup sejak menit pertama demo, dengan atau tanpa koneksi shared DB.

**GCP credit $60 dari panitia**: pakai untuk VPS deploy (Compute Engine, region `asia-southeast2` Jakarta — satu region dengan shared DB → latensi minimal). Ganti password default akun GCP segera.

---

## 7. Agent & tools (Mastra)

Agent `kopra` — model `claude-opus-4-8`, system prompt: bahasa Indonesia sederhana, persona asisten koperasi, aturan RAG di §5, tidak pernah menghitung angka sendiri.

| Tool | Fungsi (TS + Prisma, deterministik) |
|---|---|
| `createTransactionDraft` | validasi unit usaha & kategori → insert DRAFT → return ringkasan |
| `getFinancialSummary` | SQL agregat per bulan/unit + perbandingan & growth % |
| `listUnpaidMembers` | query simpanan wajib belum lunas |
| `generateReport` | generate Buku Kas / Laba Rugi → return URL |
| `searchKoperasiGuides` | vector search pgvector → chunks + sumber |

Workflow `recordTransaction`: parseDraft → `.suspend()` (kirim konfirmasi WA, state di Postgres, tahan restart) → resume("YA") → CONFIRMED / resume(lain) → koreksi-batal.

Webhook `/wa/webhook` (NestJS): identify nomor → ada workflow suspended? resume via Mastra API : panggil agent via Mastra API (memory thread per nomor) → balas via WAHA. NestJS = guardrail & audit; apps/agent = otak. Pembagian kerja: dev 1 = api+web (ERP/CRUD), dev 2 = agent+RAG+WA flow.

---

## 8. Fase eksekusi

| Fase | Kapan | Isi | Done = |
|---|---|---|---|
| **0 Prep** | sebelum sprint | scaffold monorepo, docker-compose jalan di VPS, WAHA pairing nomor burner, seed data, dokumen RAG P1–P2 terkumpul & bersih, `skills add mastra-ai/skills` | `docker-compose up` → webapp kosong live + WA terhubung |
| **1 ERP core** | jam 0–8 | schema+seed, dashboard, ledger, unit usaha, anggota, laporan | juri bisa lihat webapp hidup dengan data |
| **2a WA teks** | jam 8–16 | webhook, agent+5 tools, workflow YA, RAG nyala | demo WA→ledger→laporan end-to-end |
| **2b WA media** | jam 16–20 (stretch) | media plumbing, OCR nota, lalu STT | foto nota → draft; voice → draft |
| **3 Web chat + polish** | jam 20–28 | chat asisten dashboard, landing, halaman learning path statis, login rapi | semua halaman demo-ready |
| **4 Hardening & pitch** | jam 28–36 | polish UI, seed final, **rekam video demo 3 menit (asuransi WAHA)**, submit repo+deck+demo link+kredensial juri, latihan pitch | submission lengkap sebelum deadline |

**Aturan potong scope kalau kepepet (urutan korban):** should-have ERP → RAG P3 → STT → OCR → halaman learning path. **Tidak pernah dikorbankan:** WA flow teks + konfirmasi YA, dashboard+laporan, RAG P1.

---

## 9. BACKLOG (roadmap slide, JANGAN dibangun saat sprint)

- **Course interaktif "Jadi Agen Digitalisasi Desa"** (5 modul scenario-branching + capstone praktik di ERP sandbox + badge). Diputuskan 10 Jul: cukup halaman statis untuk demo.
- Gamifikasi (XP, leaderboard, streak)
- Inventory/stok & POS
- Integrasi SIMKOPDES / Satriya KDMP (API)
- MCP server untuk tool layer ("MCP-ready" disebut di slide arsitektur)
- Excel import, OCR massal, approval berjenjang, multi-koperasi, Neraca lengkap, SHU simulation
- Evals otomatis Mastra untuk kualitas jawaban RAG

---

## 10. Demo script 5 menit (draft)

1. **Hook (30s)**: angka 92% akun vs <1% aktif → "masalahnya bukan aplikasi, tapi kebiasaan"
2. **WA demo (2m)**: kirim "catat pemasukan banyu 500rb…" → draft → YA → **pindah layar: transaksi muncul di webapp** → tanya "pemasukan bulan ini vs bulan lalu?" → jawaban berangka → (kalau 2b jadi: foto nota / voice note)
3. **Webapp (1m)**: dashboard → laporan Laba Rugi print-ready → "laporan yang tadinya seminggu, jadi satu chat"
4. **RAG (30s)**: "beli stok air masuk operasional atau persediaan?" → jawaban + sumber
5. **Pilar 4 & closing (1m)**: halaman learning path → "kami melatih Gen Z jadi agen digitalisasi — literasi yang lulus jadi aktivasi" → roadmap (course interaktif, MCP, integrasi SIMKOPDES) → dampak

## 11. Compliance TOR (jangan lupa)
- Submission: repo publik + README (install guide + arsitektur), pitch deck PDF ≤12 slide, link demo aktif + **kredensial akun uji juri**, video ≤3 menit (unlisted)
- **Disclosure AI**: cantumkan penggunaan Claude Code/Codex sebagai coding assistance + bagian mana yang dibantu. Ide inti = orisinal tim (riset lapangan Bu Anita/Pak Tedjo).
- HAKI beralih ke Kemenkop jika Top 10 — sudah di-consent.
