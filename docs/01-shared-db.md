# Shared Database Panitia (SIMKOPDES) — Dokumentasi & Insight

**Diaudit:** 10 Jul 2026 · **Sumber:** email panitia ("Simkopdes Hackaton", 10 Jul 09:39)
**Kredensial:** di `.env` / email panitia — ⚠️ **JANGAN pernah commit** (repo publik saat submission; kredensial dipakai 100 tim)

## Fakta akses
- Postgres shared panitia (host & kredensial: lihat email panitia / `.env` tim — sengaja tidak ditulis di sini), db `hackathon_2026` — **READ-ONLY** (CREATE/INSERT ditolak; instruksi "table prefix" di email tidak bisa dijalankan → keputusan: **dump lokal**, lihat bawah)
- pgvector tersedia di server tapi tidak terinstall & tak bisa kita install
- Dipakai bersama 100 tim → asumsikan lambat/tumbang saat sprint → **selalu kerja dari dump lokal**
- PII sudah dianonimkan (nama `SAMPLE-ANGGOTA` / `Pengurus-XXXX`, NIK di-masking, alamat di-masking) → dump lokal aman, tapi tetap jangan publish mentah

## Dump lokal (SELESAI 10 Jul, ~69 MB)
- `db_dump/schema.sql` — DDL 27 tabel (digenerate dari information_schema)
- `db_dump/<tabel>.csv` — semua data, CSV header (terbesar: simpanan_anggota 43 MB, anggota_koperasi 12 MB, kbli 4 MB)
- Restore ke Postgres lokal: `psql -d simkopdes_source -f schema.sql` lalu per tabel `\copy <tabel> FROM 'db_dump/<tabel>.csv' CSV HEADER` (bikin script `restore.sh`; atau import script baca CSV langsung)
- ⚠️ Masukkan `db_dump/` ke `.gitignore` — jangan ikut repo publik
- Kamus data: `shared_db_metadata.csv` (289 field) + `shared_db_relasi.csv` (60 relasi) — dari xlsx panitia
- (pg_dump SQL tunggal bisa dibuat nanti via docker `postgres:16-alpine` kalau Docker Desktop nyala — CSV ini sudah cukup untuk restore & import)

## Isi: 27 tabel (row count per 10 Jul)

| Kelompok | Tabel (rows) |
|---|---|
| Profil & wilayah | profil_koperasi (1.026) · referensi_koperasi_wilayah (1.026) · referensi_wilayah (1.026) · referensi_profil_desa (1.026: populasi, dana desa) · referensi_komoditas_desa (8.191: komoditas + nilai potensi) · kbli_koperasi (35.591) |
| Orang | anggota_koperasi (74.269) · pengurus_koperasi (8.482) · karyawan_koperasi (942) |
| Keuangan | simpanan_anggota (372.407) · modal_koperasi (26!) · akun_bank_koperasi (903) · pengajuan_pembiayaan (118) · pengajuan_rekening_bank (652) |
| Operasional | transaksi_penjualan (1.000) · produk_koperasi (13.974) · inventaris_produk (13.974) · barang_masuk_produk (665) · barang_keluar_produk (884) · gerai_koperasi (1.942) · aset_koperasi (924) |
| Kelembagaan | rat_koperasi (341) · dokumen_koperasi (4.171) · pengajuan_kemitraan (3.254) · pengajuan_domain (1.039) |

Join key utama: `koperasi_ref` (mis. `KOP-539EF09CDAAD`) ada di hampir semua tabel; wilayah via `kode_wilayah`.

## INSIGHT UNTUK MVP (hasil profiling)

1. **76% anggota "Tidak Punya Akun"** (56.645 dari 74.269) — angka aktivasi terburuk justru di level anggota. → Memperkuat pendekatan WhatsApp-first: anggota tidak perlu install/registrasi app.
2. **61% simpanan UNPAID** (226.912 record, nilai 0; yang PAID rata-rata Rp58 ribu) — penagihan simpanan wajib adalah pain keuangan #1 yang terlihat di data. Periode data sampai Sep 2027 (jadwal ke depan sudah digenerate). → Fitur simpanan (reminder + catat pembayaran) naik prioritas.
3. **Transaksi penjualan cuma 1.000 row** di 418 koperasi (Des 2025–Jul 2026), semua 'Paid/Cash' — data operasional harian nyaris kosong. → Bukti activation gap di data resmi; Kopra mengisi persis lubang ini.
4. **Infrastruktur BUKAN penghalang**: mayoritas gerai punya listrik & internet (1.204 gerai aktif dengan keduanya). → Mematahkan "desa belum siap digital"; masalahnya kebiasaan & tools, bukan infra.
5. **RAT baru 341 record** (~⅓ koperasi), dengan field laporan_posisi_keuangan & laporan_hasil_usaha. → Laporan Kopra bisa diframe "siap RAT" — output Buku Kas/Laba Rugi mengarah ke kebutuhan pelaporan RAT resmi.
6. **Produk gerai = sembako riil** (telur, MinyaKita, gas LPG 3kg, gula, tepung). → Seed transaksi demo pakai produk nyata ini biar terasa otentik.
7. **modal_koperasi cuma 26 row** dari 1.026 koperasi — pencatatan modal hampir tak dipakai.
8. Konteks desa kaya: populasi, dana desa, komoditas + nilai potensi per desa → bahan jawaban RAG kontekstual ("potensi desamu apa") tanpa harus jadi fitur sendiri.

## Cara Kopra memakai data ini

1. **Import onboarding (fitur demo):** pilih 1 `koperasi_ref` → tarik profil + anggota + pengurus + simpanan (status PAID/UNPAID asli) dari dump → masuk DB Kopra → "onboarding koperasi dari data resmi dalam satu perintah".
2. **`listUnpaidMembers` & dashboard simpanan** jalan di data resmi asli.
3. **Seed transaksi harian** tetap sintetis ala Excel Pak Tedjo + produk sembako riil dari `produk_koperasi` (karena data transaksi resmi memang tipis — dan ketipisannya itu poin pitch).
4. **Statistik pitch** (76% tanpa akun, 61% unpaid, 1.000 transaksi) → slide problem, sitasi "analisis dataset resmi SIMKOPDES Hackathon 2026".
