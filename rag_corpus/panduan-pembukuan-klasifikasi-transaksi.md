---
title: Panduan Praktis — Klasifikasi Transaksi Koperasi Sektor Riil (KDMP)
sourceType: guide
source: disusun tim Kopra dari standar akuntansi koperasi (SAK EP) & praktik pembukuan KDMP; kode akun mengikuti struktur COA aplikasi Koperasi Merah Putih CORE
year: 2026
accessed: 2026-07-10
relevance: menjawab pertanyaan klasifikasi harian — "beli stok masuk operasional atau persediaan?", uang masuk/keluar dicatat sebagai apa
---

# Klasifikasi Transaksi Koperasi Sektor Riil

Setiap uang masuk/keluar koperasi harus dicatat ke **satu kategori yang tepat**. Salah klasifikasi membuat laporan laba rugi dan neraca menyesatkan. Panduan ini memakai 6 kategori utama.

## Ringkasan 6 kategori

| Kategori | Kode akun (COA CORE) | Intinya | Contoh khas KDMP |
|---|---|---|---|
| 1. Pendapatan | 4xx (mis. 410000) | Uang masuk dari kegiatan usaha | Penjualan sembako, gas LPG, pupuk; fee BRILink/PPOB/Pospay; komisi channeling |
| 2. Persediaan (kulakan) | 114000 | Beli barang **untuk dijual lagi** | Kulakan beras, air mineral, minyak goreng, tabung gas isi, pupuk |
| 3. Beban operasional | 5xx (mis. 510000) | Biaya menjalankan usaha, habis dipakai, **tidak untuk dijual** | Listrik, gaji karyawan, transport, ATK, pulsa, konsumsi rapat, sewa |
| 4. Aset/investasi | 12x | Beli barang tahan lama (>1 tahun) untuk dipakai usaha | Etalase, kulkas, timbangan, komputer, renovasi gerai |
| 5. Modal & simpanan | 310000 (pokok) / 320000 (wajib) | Uang masuk/keluar dari anggota atau pinjaman | Simpanan pokok/wajib/sukarela, pinjaman LPDB/bank, hibah |
| 6. Non-usaha / lain-lain | — | Di luar kegiatan usaha inti | Bunga bank, dana sosial, pajak |

Pendapatan dicatat **per unit usaha** bila koperasi punya beberapa gerai (kode 41x per unit) — supaya kelihatan unit mana yang paling menghidupi koperasi.

## Aturan cepat membedakan (decision rules)

1. **"Barang ini akan dijual lagi?"** → Ya = **persediaan** (bukan beban!). Tidak = lanjut aturan 2.
2. **"Barang/jasa ini habis dipakai kurang dari setahun?"** → Ya = **beban operasional**. Tidak = **aset/investasi**.
3. **"Uang ini dari anggota (simpanan) atau pinjaman?"** → Bukan pendapatan! Catat sebagai **modal/simpanan** (ekuitas) atau **utang**. Simpanan pokok/wajib TIDAK BOLEH dicatat sebagai pendapatan.
4. **"Uang masuk dari penjualan?"** → **Pendapatan**, dan ingat barang yang keluar mengurangi persediaan (menjadi HPP).

## Kasus yang paling sering ditanya

**"Beli stok air mineral untuk dijual di gerai, masuk operasional atau persediaan?"**
→ **Persediaan.** Barang yang dibeli untuk dijual kembali dicatat sebagai persediaan (aset), bukan beban operasional. Barang itu baru menjadi beban (Harga Pokok Penjualan) **pada saat terjual**. Kalau dicatat sebagai beban operasional saat kulakan, laba bulan itu tampak anjlok padahal barangnya masih ada di rak.

**"Beli galon + dispenser untuk minum karyawan?"**
→ Bukan untuk dijual → bukan persediaan. Air galon isi ulang = **beban operasional** (habis dipakai). Dispensernya = kalau nilainya kecil boleh langsung beban; kalau signifikan dan tahan lama = **aset/peralatan**.

**"Bayar listrik gerai?"** → **Beban operasional** (beban listrik/utilitas).

**"Beli kulkas untuk display minuman?"** → **Aset/investasi** (peralatan usaha) — tahan lama, dipakai usaha, bukan untuk dijual. Nilainya disusutkan tiap tahun, bukan jadi beban sekaligus.

**"Anggota bayar simpanan wajib Rp 20.000?"** → **Modal (ekuitas)** — menambah simpanan wajib anggota tsb. BUKAN pendapatan koperasi.

**"Terima pencairan pinjaman LPDB?"** → **Utang (liabilitas)** — bukan pendapatan. Uangnya menambah kas, kewajibannya dicatat sebagai utang pinjaman.

**"Beli tabung gas LPG isi dari agen?"** → **Persediaan** (untuk dijual). Uang jaminan tabung kosong (bila ada) = aset lain, bukan beban.

**"Bayar gaji karyawan gerai sembako?"** → **Beban operasional** (beban kepegawaian). Praktik baik: pisahkan per unit usaha (gaji karyawan sembako vs karyawan pupuk) agar laba per gerai terlihat.

**"Ongkos transport ambil kulakan?"** → Idealnya ditambahkan ke **harga perolehan persediaan** (biaya untuk membawa persediaan ke lokasi). Praktik sederhana yang masih bisa diterima: catat sebagai beban operasional (transport) — yang penting **konsisten**.

**"Beli ATK untuk kantor koperasi?"** → **Beban operasional**. Tapi kalau ATK itu untuk **dijual** di gerai (mis. buku tulis), itu **persediaan**.

**"Kasih pinjaman ke anggota (unit simpan pinjam)?"** → **Piutang** (aset) — bukan beban. Angsuran masuk = mengurangi piutang; **bunganya/jasanya saja** yang dicatat pendapatan.

**"Setor uang tunai gerai ke rekening bank koperasi?"** → **Bukan transaksi pendapatan/beban** — hanya pemindahan antar kas (kas gerai → bank). Dicatat sebagai mutasi kas.

## Kas vs Bank

Uang tunai di laci/brankas = akun **Kas** (111000). Uang di rekening = akun **Bank** (mis. Bank BRI 112100). Saat mencatat, sebutkan "lewat bank" kalau uangnya masuk/keluar rekening — supaya saldo kas fisik dan saldo rekening sama-sama cocok saat dihitung (opname kas & rekonsiliasi bank).

## Kesalahan umum di lapangan (dari temuan riset KDMP)

1. **Kulakan dicatat sebagai pengeluaran/beban** → laba bulan kulakan besar tampak rugi. Ingat: kulakan = persediaan.
2. **Simpanan anggota tercampur dengan pendapatan** → SHU membengkak palsu. Simpanan adalah modal milik anggota.
3. **Pencairan pinjaman dianggap pemasukan usaha** → laporan laba menyesatkan. Pinjaman = utang.
4. **Uang pribadi pengurus tercampur kas koperasi** → selalu pisahkan; kalau pengurus menalangi, catat sebagai utang koperasi kepada pengurus.
5. **Pembelian aset besar dibebankan sekaligus** → gunakan penyusutan (garis lurus) sesuai kebijakan akuntansi koperasi.
6. **Tidak konsisten** — aturan boleh disederhanakan, tapi harus sama setiap bulan agar laporan bisa dibandingkan.

## Kata kunci klasifikasi cepat (kosakata lapangan)

- *kulakan, belanja stok, restock, beli barang dagangan* → **persediaan**
- *laku, terjual, penjualan, omzet, pembeli bayar* → **pendapatan** (+ kurangi stok → HPP)
- *listrik, token, pulsa, bensin, gaji, honor, ATK kantor, sewa, retribusi* → **beban operasional**
- *etalase, rak, kulkas, freezer, timbangan, motor, renovasi, komputer, printer* → **aset**
- *simpanan pokok, simpanan wajib, simpanan sukarela, setoran anggota* → **modal/simpanan**
- *pencairan LPDB, pinjaman bank, angsuran ke bank* → **utang** (angsuran = kurangi utang; bunganya = beban)
