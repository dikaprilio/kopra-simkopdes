# KOPRA — Full Context Summary (Handoff Lengkap)

**Ditulis:** 10 Jul 2026 sore · **Untuk:** semua anggota tim + sesi coding agent (Claude Code/Codex) baru
**Baca berpasangan dengan:** [`00-core-features.md`](00-core-features.md) (spec scope — satu-satunya sumber kebenaran fitur). Dokumen ini = SEJARAH & ALASAN di balik spec.

---

## 1. Kompetisi

- **Event:** Hackathon Digital Cooperatives Expo 2026 ("Hack The Cooperatives") — Kementerian Koperasi RI × PEBS FEB UI. Situs: hackathon.simkopdes.go.id
- **Tim:** **Fandelion** — Dika + Aldio (fullstack, keduanya men-drive coding agents Claude Code & Codex) + 1 hustler (PPT, pitching, ide)
- **Pilar terdaftar:** **1 — Peningkatan Volume Usaha Koperasi** *(pindah dari Pilar 4 pada 10 Jul sore — tesis "CRUD harian via WA" jauh lebih pas di Tema 1: volume usaha, efisiensi operasional, produktivitas, keberlanjutan; kategori solusi "Digitalisasi Operasional Koperasi")*
- **Timeline aktual:** sprint hacking maraton **Jum–Sab 10–11 Jul 2026, Flores Ballroom Hotel Borobudur Jakarta** (24–36 jam); Pitching Day 10–11 Jul; Awarding 12 Jul (3 pemenang dari 10 finalis)
- **Bobot penilaian:** Relevansi tema 25% · Inovasi/novelty 20% · Dampak & manfaat 20% · Kemudahan implementasi 15% · Kualitas teknologi 15% · Presentasi 5%
- **Submission wajib:** repo publik (source MVP + README install & arsitektur) · pitch deck PDF ≤12 slide · link demo aktif + **kredensial akun uji juri** · video demo ≤3 menit unlisted (opsional tapi kami WAJIBKAN sebagai asuransi WAHA) · dikumpulkan via portal SIMKOPDES sebelum deadline sprint (telat 1 detik = gugur)
- **Aturan AI (TOR):** ide inti harus orisinal peserta (bukan hasil generatif langsung); AI boleh untuk coding assistance/debug/riset/aset; **wajib disclosure** penggunaan AI (sudah ditulis di README); pelanggaran = diskualifikasi
- **HAKI:** Top 10 wajib alihkan HAKI ke Kemenkop (consent sudah ditandatangani)
- **Fasilitas panitia (email 10 Jul, dari simkopdes.hackaton@pendamping.kop.id):** GCP credit $60 (3 akun `hackaton.group20a/b/c@pendamping.kop.id`, password default HARUS diganti) + shared database (lihat §5)

## 2. Evolusi tesis produk (penting untuk paham "kenapa")

1. **Awal:** Pilar 4 murni — learning path/gamifikasi Gen Z (handoff doc lama: Kopra = ERP ringan + WA assistant + RAG + course Gen Z)
2. **Pivot 1 (9 Jul):** learning path dijadikan **bridge**; urgensi utama = **activation gap** digitalisasi KDMP (92% punya akun SIMKOPDES, <1% aktif). Course interaktif → **BACKLOG** (cukup halaman statis sebagai artefak Pilar 4)
3. **Pivot 2 (10 Jul pagi):** setelah audit DB panitia + baca ulang interview — inventaris ternyata BERGUNA (Bu Anita) tapi gagal diadopsi karena interface & SDM → tesis final: **"Kopra = antarmuka WhatsApp untuk CRUD harian koperasi"** (transaksi, stok, simpanan). Fitur resmi sudah ada; yang mati adalah INPUT HARIAN; WA = tempat pengurus benar-benar bekerja
4. **Pivot 3 (10 Jul sore):** revamp sistem keuangan ke struktur **"Koperasi Merah Putih CORE" resmi** (COA + jurnal double-entry + Buku Besar/Neraca Saldo/PHU/Neraca) — jangan berpaku format xlsx Pak Tedjo (susah distandardisasi). Pitch line: *"chat masuk, jurnal CORE-standard keluar."*
5. **Pivot 4 (10 Jul sore):** pindah **Pilar 4 → Pilar 1** (Volume Usaha). Konsekuensi: halaman learning path statis → backlog (tak perlu artefak Gen-Z lagi); relevansi kini langsung — pembukuan+stok+simpanan tercatat = volume usaha terlihat, laporan siap RAT = syarat kemitraan/pembiayaan. Gen-Z tinggal 1 slide dampak sosial.

## 3. Riset yang sudah dilakukan (semua tersitasi, siap pitch)

### 3a. Riset web (9 Jul — `02-riset-adoption-gap.md`)
- 81.485 KDMP berbadan hukum; 92,69% punya akun SIMKOPDES; hanya ~11% update profil; **0,45% (368 koperasi) kirim proposal bisnis**; transaksi tercatat: Banten 34,8%, Jawa ~24–25%, Papua/Maluku nihil
- Target pemerintah: 36–40 ribu kopdes beroperasi akhir 2026; baru 31% gerai fisik selesai (Jun 2026)
- **Gen Z cuma ~6% anggota koperasi** (survei ICCI); pendidikan koperasi tidak ada di kurikulum
- LMS pemerintah SUDAH ADA 3+: lms.kop.go.id, lms.merahputih.kop.id, EDUKUMKM, kursus KLC2 Kemenkeu → "bikin platform belajar" TIDAK novel
- **kdmp.id kemungkinan vendor swasta** (Menara Palma, "300+ klien") — JANGAN sebut "SaaS pemerintah" di pitch; baseline resmi = SIMKOPDES + KDMP Mobile + LMS Kemenkop
- Fragmentasi platform = masalah nyata: SIMKOPDES, Satriya KDMP (Bantul), RUNS Accounting+, Telkom, kdmp.id, kopdesa.com, dst.

### 3b. Interview lapangan (transkrip di `riset-lapangan/`)
**Bu Anita — Sekretaris KDMP Bangunharjo, Sewon, Bantul (mockup NASIONAL, diresmikan Prabowo 21 Jul 2025):**
- 7 gerai; mitra banyak (Bulog, Pupuk Indonesia via e-RDKK 257 petani, Kimia Farma, ID FOOD, PT Pos, Brilink, channeling Bank Mandiri utk simpan pinjam krn Permenkop 6 syarat modal Rp500jt)
- Modal awal: barang mockup DITARIK 4 hari pasca peresmian; pengurus pinjam LPDB **atas nama pribadi dgn jaminan sertifikat rumah** (grace period 6 bln)
- Punya app vendor sendiri **kmpbangunharjo.com** (pertama di Bantul, buatan Karang Taruna): simpanan, penagihan, belanja sembako QRIS/transfer/COD, **kasir + stock opname barcode + fast-moving + barang rusak — "sangat membantu"**
- Pain: **input 3x data yang sama** (app internal + Satriya + SIMKOPDES); minta one-door
- **Anggota sepuh tak buka app → penagihan simpanan tetap manual kolektif via WA**; 6x nunggak = nonaktif; pemesanan mitra pun "manual via chat WhatsApp"
- Gen Z: Karang Taruna baru ~10 anggota; simpanan pokok 100rb + wajib 10rb/bln berat buat mahasiswa
- Bantul: 75 KDMP, baru 2 punya bangunan
**Pak Tedjo — Wakil Ketua Bidang Usaha KDMP Palbapang, Bantul (grassroots, Excel-first):**
- Unit usaha: BRILINK, POSPAY, BANEW (air minum), GERAI KANTOR, MITRA SPPG (bagi hasil pisang), AGRO MANDIRI (+rencana: agrowisata, Bulog, lele)
- Pain inti: **tidak ada standar pembukuan praktis** — klasifikasi transaksi (operasional/investasi/persediaan) & konsolidasi laporan (laba rugi, neraca) susah; pelatihan ada tapi fokus simpan-pinjam, bukan sektor riil
- Semua laporan via Excel + share WA grup; minta: "catat transaksi → laporan otomatis"

### 3c. Berkas lapangan (`riset-lapangan/berkas-lapangan-anonim.md` + `berkas-raw/palbapang/`)
- 4 xlsx Palbapang di repo (Buku Bank, Kas Umum, Kas Operasional, Laporan Unit Usaha): sheet per bulan, kolom `No|Tanggal|Uraian|Bukti|Debet|Kredit|Saldo|Ket`; **#REF! errors**; kolom pinjaman pihak-3 ditempel di pinggir; bayar simpanan RAPEL multi-bulan; kosakata asli ("bagi hasil pisang", "laba brilink", "belanja banew") → dipakai untuk SEED & test parser WA
- **LPJ RAT Bangunharjo (PDF 44 hal) TIDAK di repo** — berisi daftar hadir (nama+alamat+ttd anggota) = PII. Outline lengkap sudah di dokumen anonim. Insight: banyak field `Rp ……` kosong → "generateReport = mengisi LPJ RAT otomatis"
- Statistik nasional (`docs/data/*.json`): 83.404 KDMP, 79.698 akun microsite, 42.302 gerai aktif vs 19.716 nonaktif, 1,77 jt anggota

### 3d. Audit DB panitia (10 Jul — `01-shared-db.md`)
- **Read-only** (CREATE ditolak → instruksi "table prefix" email tak jalan); pgvector ada tapi tak terinstall; dipakai 100 tim → **selalu kerja dari mirror lokal**
- 27 tabel: 1.026 koperasi · 74.269 anggota · **372.407 simpanan (61% UNPAID)** · 8.482 pengurus (**umur median 44**, 49% ≥45) · 13.974 produk di 640 koperasi tapi **cuma 301 koperasi pernah catat barang masuk/keluar** · transaksi penjualan cuma 1.000 row · **76% anggota "Tidak Punya Akun"** · gerai mayoritas ada listrik+internet (infra BUKAN penghalang) · RAT baru 341 · PII di-masking (nama SAMPLE-ANGGOTA, NIK/alamat masked, tgl lahir `1973-**-**`)
- Join key: `koperasi_ref` (mis. `KOP-539EF09CDAAD`), wilayah via `kode_wilayah`; kamus data: `docs/data/shared_db_metadata.csv` + `shared_db_relasi.csv`

### 3e. Tutorial suite resmi KDMP (10 Jul, oleh Aldio — `docs/data/kdmp-modules-tutorial/`)
4 aplikasi terpisah melayani satu KDMP (vendor: subaga; payment Xendit; email pengurus @kdmp.id):
1. **Koperasi Merah Putih CORE** (back-office pengurus): menu Dashboard · Akuntansi (COA hirarkis, Jurnal `JU-xxx` dgn lines COA/Debit/Kredit) · Pinjaman (approve pengajuan dari Mobile) · Master Data (Anggota, Pengurus + 5 role) · Laporan (**Buku Besar, Neraca Saldo +Status Balance, PHU, Neraca**). Contoh COA: 100000 AKTIVA, 111000 Kas Rupiah, 112100 Bank BRI
2. **Warehouse App**: gudang, barang masuk/keluar, bin-to-bin, stock count (cycle/full, adjudication), kualitas Inventaris/Karantina/Rusak, pola Terima/Tolak
3. **KDMP Mobile** (anggota, member.kdmp.id): registrasi, simpanan pokok (sekali) & wajib (bulanan), pinjaman & angsuran, PPOB; bayar via VA/QRIS/e-wallet
4. **POS System** (kasir, UI Inggris): katalog, penjualan, promosi, laporan
→ **Kopra meniru struktur CORE** untuk keuangan; tutorial ini juga = konten RAG `module_tutorial`

## 4. Keputusan arsitektur & alasan (LOCKED — jangan re-litigasi)

| Keputusan | Alasan singkat |
|---|---|
| **Mastra** (TS agent framework) | workflow suspend/resume durable (konfirmasi YA tahan restart), memory & RAG first-class, evals, **Mastra Skills** utk coding agents; dipilih setelah riset standar industri (LangGraph=Python-first, ditolak; Vercel AI SDK=lapisan bawahnya; Dify=GUI tak bisa diedit agent, self-host berat) |
| **Monorepo pnpm 3 app** `web`(Next.js) / `api`(NestJS) / `agent`(Mastra server standalone) + `packages/db`(Prisma) | pemisahan backend proper (user menolak Next.js-only); NestJS sesuai rencana awal tim & sangat dikenal LLM; Mastra server punya playground `mastra dev`; split kerja bersih Dev1(api+web) vs Dev2(agent+WA) |
| **Gateway WA = GoWA** (go-whatsapp-web-multidevice) di repo terpisah [`kopra-whatsapp-waha`](https://github.com/dikaprilio/kopra-whatsapp-waha) | menggantikan WAHA (10 Jul malam): binary Go ringan (VPS kecil), media download + webhook HMAC built-in, MCP server (dev-time testing + pitch), gratis MIT. WAHA = fallback ter-comment. WAJIB: adapter di balik interface `WhatsappGateway` + volume `storages/` (pairing hilang kalau dihapus) |
| WA = **gateway asli all-in** (bukan simulasi) | keputusan user; mitigasi = rekam video demo 3 menit |
| Model LLM | `claude-opus-4-8` (agent + OCR vision); STT Whisper via Groq (fase 2b) |
| DB app sendiri (docker `pgvector/pgvector:pg16`, port **5433**) | shared DB panitia read-only & dipakai 100 tim; mirror lokal utk import |
| Deploy | 1 VPS GCP **asia-southeast2** (credit $60 panitia; satu region dgn shared DB), docker-compose |
| **Keuangan = COA + jurnal double-entry ala CORE** | standarisasi (xlsx lapangan tidak seragam), kredibilitas akuntansi, familiar bagi juri Kemenkop, future-proof integrasi |
| **LLM explains, backend calculates** | angka SELALU dari SQL; commit = kode deterministik pasca "YA"; posting rules = kode, bukan LLM |
| Git | commit langsung ke main, kecil & sering; **TANPA Co-Authored-By** (permintaan user); jangan pernah commit `.env`/dump/kredensial |

## 5. Infrastruktur, data & kredensial (LOKASI, bukan isinya — repo publik!)

- **Shared DB panitia:** host+kredensial di email panitia ("Pengiriman Berkas Komitmen Kepesertaan Tim Fandelion") & `.env` tim. READ-ONLY.
- **Mirror lokal (laptop Dika):** Postgres 18 localhost:5432, db `hackathon_2026`, user postgres (password diketahui tim) — 27 tabel identik + index + PK. Resync: `scripts/resync_source_db.py` (env-only).
- **Dump:** `Simkopdes/db_dump/` lokal (schema.sql + 27 CSV ≈69MB + `hackathon_2026_full.sql` 71MB via pg_dump). TIDAK di repo (gitignore).
- **GCP:** 3 akun grup 20a/b/c, credit $60 — **ganti password default segera**, provision VPS.
- **GoWA:** perlu **nomor burner** (jangan nomor pribadi), pairing QR sekali via UI GoWA, jangan hapus volume `storages/`.
- **Berkas asli lapangan:** folder lokal `Simkopdes/` (xlsx sudah dicopy ke repo; LPJ PDF & JSON list 83k koperasi tetap lokal-only).

## 6. Keadaan repo SEKARANG (10 Jul sore, commit `f4c7ce1`)

**Sudah ada:**
- Struktur monorepo + workspace + root scripts + docker-compose (postgres aktif; api/agent/web ter-comment nunggu Dockerfile)
- `packages/db/prisma/schema.prisma` **FINAL 15 model** (COA/Journal/Lines, MemberSaving POKOK|WAJIB per periode, Product/StockMovement→journalEntryId, RagDocument vector(1024), AuditLog) — belum pernah `db push` (belum ada DB jalan)
- Docs lengkap: `00-core-features.md` (SPEC UTAMA), `01-shared-db.md`, `02-riset…`, `03-brainstorming-handoff` (versi lama, konteks sejarah), `CONVENTIONS.md` (pembagian kerja, ports, git, scope guard), `CONTEXT.md` (ini), `riset-lapangan/` (2 transkrip + anonim + xlsx raw), `data/` (statistik + kamus + **kdmp-modules-tutorial/** 5 file)
- README root (quickstart, disclosure AI) + README per app berisi **perintah scaffold persis**
- `.env.example` lengkap · `.gitignore` (env, db_dump, sql)
- Repo infra WAHA: compose + panduan pairing + endpoint yang dipakai api

**BELUM ada (kerjaan berikutnya, urut):**
1. Scaffold 3 app (`create-next-app` / `nest new` / `create mastra` — perintah di README masing-masing) + `npx skills add mastra-ai/skills`
2. `docker compose up postgres` → `pnpm db:push`
3. `packages/db/src/`: `index.ts` (client singleton), `seed.ts` (koperasi + 6 unit + **COA default KDMP** + ~2 bln jurnal via posting rules dgn kosakata asli + simpanan per periode + 2 user: `pengurus@kopra.id`/`anggota@kopra.id`), `import-koperasi.ts` (dari mirror: profil+anggota+pengurus+simpanan+produk)
4. Implementasi api (kontrak §4 spec) · agent (7 tools + workflow `recordEntry` + RAG ingest) · web (menu ala CORE)
5. GoWA pairing + webhook end-to-end (HMAC)
6. Korpus RAG P1–P2 (`rag_corpus/`): panduan pembukuan, konsep koperasi, UU 25/1992, Inpres 9/2025, FAQ KDMP + tutorial modules (sudah ada) + transkrip interview (tag field_research)
7. Deploy VPS + video demo + deck

## 7. Scope MVP satu paragraf (detail penuh di spec §3–7)

ERP web ala CORE (Dashboard kartu akuntansi; COA; Jurnal; Produk+Stok; Anggota+Simpanan per periode; 4 laporan resmi + view Buku Kas) + WA assistant (7 flows: F0 nomor asing, F1 catat transaksi→draft→YA, F2 tanya keuangan, F3 RAG, F4 penunggak+template (tanpa auto-broadcast), F5 minta laporan, F6 media OCR/STT (2b), F7 stok "kejual minyakita 5"→jurnal+movement atomik) + chat web (otak sama) + landing + learning path statis + import 1 koperasi dari data resmi. State machine: satu draft pending per chat; IDLE↔AWAITING_CONFIRMATION; Mastra workflow suspended = state. **Fase:** 0 prep → 1 ERP (jam 0–8) → 2a WA teks (8–16) → 2b OCR→simpanan→STT (16–20) → 3 chat web+polish (20–28) → 4 hardening+submission (28–36). **Urutan potong:** RAG P3 → STT → simpanan 2b → OCR → learning path → should-have ERP; **tak pernah dipotong:** F1+F7, dashboard+laporan, RAG P1, import.

## 8. CUT & jawaban juri (hafalkan)

- **POS/kasir/barcode:** "Segmen yang butuh kasir sudah dilayani vendor (kasus Bangunharjo). Target kami 700+ koperasi TANPA app vendor; stok kami movement-log via WA, bukan point-of-sale." (Data: 640 daftar produk vs 301 mencatat.)
- **Kok dulu Pilar 4 / mana unsur Gen-Z?** "Kami pindah ke Pilar 1 karena riset menunjukkan pain terbesar di volume usaha & operasional harian. Gen-Z tetap di roadmap (learning path 'agen digitalisasi') sebagai jalur regenerasi pengurus (median umur 44)."
- **Kenapa transaksi CONFIRMED tak bisa diedit?** "Prinsip pembukuan: koreksi lewat jurnal balik — auditability RAT."
- **Integrasi SIMKOPDES?** "Struktur data kami sengaja se-shape dengan suite resmi (COA/jurnal CORE, simpanan Mobile, movement Warehouse) — integrasi = roadmap terdekat, bukan rewrite."
- **Keamanan data?** guardrails: identity WA wajib linked, scoped koperasiId, audit_logs, template pengingat di-copy manual (no auto-broadcast).

## 9. Gotchas teknis yang sudah ditemukan (jangan diulang)

- Windows dev box; `psql`/`pg_dump` ada di `C:\Program Files\PostgreSQL\18\bin`; poppler via winget (PATH baru butuh shell restart)
- Prisma: pakai `previewFeatures postgresqlExtensions` + `extensions=[vector]`; embedding `Unsupported("vector(1024)")`
- Port 5432 = mirror panitia lokal; **5433 = DB app** (jangan ketukar)
- GoWA event → `POST /wa/webhook` (verifikasi `WHATSAPP_WEBHOOK_SECRET` HMAC-SHA256); kirim balik via `POST /send/message`; media via `GET /message/:message_id/download`; multi-akun v8 pakai header `X-Device-Id`
- Shared DB: jangan query saat demo (100 tim); tanggal lahir masked `YYYY-**-**` (parse LEFT(...,4))
- Repo akan PUBLIK: tiap commit baru — cek tak ada kredensial/PII (sudah 2x kejadian hampir bocor: IP di docs, nama lengkap narasumber di transkrip — keduanya sudah disanitasi)
