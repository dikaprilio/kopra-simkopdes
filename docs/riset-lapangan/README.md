# Riset Lapangan — Konteks Produk

Transkrip interview asli tim (Juli 2026, Bantul DIY) — dasar seluruh keputusan produk Kopra:

| File | Narasumber | Insight kunci |
|---|---|---|
| [interview_notes_bu_anita_kdmp_bangunharjo.md](interview_notes_bu_anita_kdmp_bangunharjo.md) | Bu Anita, KDMP Bangunharjo (koperasi "maju", sudah punya app vendor) | Pain: terlalu banyak sistem, input berulang, anggota tua tak buka app, reminder jatuh ke WA. Jangan rebuild POS — jadilah bridge |
| [interview_notes_pak_tejo_kdmp_palbapang.md](interview_notes_pak_tejo_kdmp_palbapang.md) | Pak Tedjo, KDMP Palbapang (grassroots, Excel-first) | Pain: klasifikasi transaksi & laporan keuangan (laba rugi, neraca, konsolidasi). Unit usaha riil: BRI Link, PosPay, Banyu, dst. Ingin "catat transaksi → laporan otomatis" |

## Berkas pendukung (TIDAK di repo — sengaja)

Ada di penyimpanan lokal tim (`Simkopdes/Berkas (Could be use for RAG and Context)/`):
- 4 file Excel laporan asli KDMP Palbapang (Buku Bank, Kas Umum, Kas Operasional, Laporan Unit Usaha 2026)
- LPJ RAT KDMP Bangunharjo (PDF)

**Alasan tidak di-commit:** ini laporan keuangan asli koperasi nyata yang dititipkan narasumber — repo ini publik saat submission. Pemakaiannya: (1) referensi struktur untuk `packages/db` seed & format laporan, (2) diubah jadi **template anonim** untuk korpus RAG (`rag_corpus/`), bukan dipublikasikan mentah.

## Data statistik nasional (di `docs/data/`)

- `cooperative_national_readiness.json` — 83.404 KDMP nasional: status legal, akun, NPWP, NIB, per provinsi
- `cooperative_phase2.json` — statistik fase 2: 79.698 akun microsite, 42.302 gerai aktif vs 19.716 nonaktif, 1,77 juta anggota, kemitraan, pembiayaan
- `shared_db_metadata.csv` + `shared_db_relasi.csv` — kamus data DB panitia (289 field, 60 relasi)

Angka-angka ini bahan slide problem & jawaban RAG kontekstual.
