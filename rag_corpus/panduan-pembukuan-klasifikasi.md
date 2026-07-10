---
title: Panduan Pembukuan — Klasifikasi Transaksi Koperasi
sourceType: guide
source: Tim Kopra (disusun mengikuti struktur COA aplikasi Koperasi Merah Putih CORE)
relevance: menjawab "transaksi X dicatat sebagai apa?" — pemasukan, beban, persediaan, simpanan
---

# Klasifikasi Transaksi Koperasi

Setiap uang yang masuk/keluar koperasi harus jelas *jenisnya*. Salah kelas = laporan
kacau saat RAT. Aturan praktisnya:

## Pemasukan (Pendapatan)

Uang masuk dari kegiatan usaha koperasi: hasil penjualan gerai, fee BRILink,
fee PPOB/Pospay, jasa unit usaha (mis. penjualan air galon "Banyu"), komisi mitra.
Dicatat sebagai **Pendapatan** (kode akun 4xx) — per unit usaha bila koperasi punya
beberapa unit, supaya kelihatan unit mana yang paling menghidupi koperasi.

Yang BUKAN pendapatan: uang simpanan anggota (itu modal, bukan penghasilan) dan
uang pinjaman/titipan.

## Pengeluaran (Beban Operasional)

Uang keluar untuk menjalankan koperasi yang *tidak menjadi barang dagangan*:
listrik, pulsa/kuota, transportasi, ATK, konsumsi rapat, gaji/insentif pengurus.
Dicatat sebagai **Beban Operasional** (kode akun 5xx). Beban mengurangi hasil usaha.

## Belanja Stok (Persediaan) — ini yang paling sering keliru

Membeli barang **untuk dijual lagi** (air mineral, minyak goreng, gas LPG, sembako
untuk gerai) BUKAN pengeluaran operasional. Itu **Persediaan** (kode akun 114000):
uangnya hanya "berubah bentuk" dari kas menjadi barang. Nilainya baru menjadi
pendapatan ketika barangnya terjual.

Contoh: beli 2 dus air mineral untuk gerai → catat sebagai *belanja stok /
persediaan*, bukan operasional. Kalau beli galon air untuk minum pengurus di
kantor → itu baru *beban operasional* (dipakai sendiri, tidak dijual).

Cara cepat membedakan: **"Barang ini nanti dijual lagi tidak?"**
Dijual lagi → Persediaan. Dipakai sendiri → Beban Operasional.

## Simpanan Anggota (Modal)

- **Simpanan Pokok** — dibayar sekali saat masuk jadi anggota; tidak bisa diambil
  selama masih menjadi anggota. Dicatat ke akun 310000.
- **Simpanan Wajib** — dibayar rutin (biasanya bulanan) dengan jumlah sama;
  boleh dibayar rapel beberapa bulan sekaligus. Dicatat ke akun 320000.

Simpanan adalah **modal koperasi milik anggota**, bukan pendapatan. Menerima
simpanan menambah kas dan menambah modal — tidak menambah "untung".

## Kas vs Bank

Uang tunai di laci/brankas = **Kas** (111000). Uang di rekening = **Bank** (112100).
Sebutkan "lewat bank" saat mencatat kalau uangnya masuk/keluar rekening, supaya
saldo kas fisik dan saldo rekening sama-sama cocok saat dihitung.

## Ringkasan satu baris

| Kejadian | Kelasnya |
|---|---|
| Hasil jualan / fee jasa | Pendapatan (4xx) |
| Bayar listrik, transport, ATK | Beban Operasional (5xx) |
| Kulakan barang dagangan | Persediaan (114000) |
| Barang dagangan terjual | Kas bertambah + Pendapatan |
| Anggota bayar simpanan pokok/wajib | Modal — Simpanan (310000/320000) |
