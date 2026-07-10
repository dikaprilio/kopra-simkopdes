# Riset Lapangan — Konteks Produk

Transkrip interview asli tim (Juli 2026, Bantul DIY) — dasar seluruh keputusan produk Kopra:

| File | Narasumber | Insight kunci |
|---|---|---|
| [interview_notes_bu_anita_kdmp_bangunharjo.md](interview_notes_bu_anita_kdmp_bangunharjo.md) | Bu Anita, KDMP Bangunharjo (koperasi "maju", sudah punya app vendor) | Pain: terlalu banyak sistem, input berulang, anggota tua tak buka app, reminder jatuh ke WA. Jangan rebuild POS — jadilah bridge |
| [interview_notes_pak_tejo_kdmp_palbapang.md](interview_notes_pak_tejo_kdmp_palbapang.md) | Pak Tedjo, KDMP Palbapang (grassroots, Excel-first) | Pain: klasifikasi transaksi & laporan keuangan (laba rugi, neraca, konsolidasi). Unit usaha riil: BRI Link, PosPay, Banyu, dst. Ingin "catat transaksi → laporan otomatis" |

## Berkas pendukung

- **[berkas-lapangan-anonim.md](berkas-lapangan-anonim.md)** ← mulai dari sini: struktur, kosakata transaksi, pola & implikasi desain dari semua berkas (paling berguna untuk AI agent)
- `berkas-raw/palbapang/` — 4 Excel laporan asli KDMP Palbapang (Buku Bank, Kas Umum, Kas Operasional, Laporan Unit Usaha 2026): referensi struktur untuk seed & format laporan
- LPJ RAT KDMP Bangunharjo (PDF 44 hal) — **tetap lokal, tidak di-commit** (berisi daftar hadir anggota: nama, alamat, tanda tangan). Outline lengkapnya ada di dokumen anonim.

## Data statistik nasional (di `docs/data/`)

- `cooperative_national_readiness.json` — 83.404 KDMP nasional: status legal, akun, NPWP, NIB, per provinsi
- `cooperative_phase2.json` — statistik fase 2: 79.698 akun microsite, 42.302 gerai aktif vs 19.716 nonaktif, 1,77 juta anggota, kemitraan, pembiayaan
- `shared_db_metadata.csv` + `shared_db_relasi.csv` — kamus data DB panitia (289 field, 60 relasi)

Angka-angka ini bahan slide problem & jawaban RAG kontekstual.
