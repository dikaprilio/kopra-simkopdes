---
title: Panduan Pembukuan — Dari Catatan Sederhana ke Jurnal Ganda
sourceType: guide
source: Tim Kopra (posting rules Kopra; sejalan dengan jurnal aplikasi CORE)
relevance: menjelaskan kenapa 1 catatan chat menjadi jurnal debit-kredit yang seimbang
---

# Dari Catatan Sederhana ke Jurnal Ganda (Double-Entry)

Pengurus cukup mencatat dengan bahasa sehari-hari ("catat pemasukan banyu 500rb").
Sistem yang menerjemahkannya menjadi **jurnal ganda** standar akuntansi — dua sisi
yang selalu seimbang: total debit = total kredit. Pengurus tidak perlu menghafal
debit-kredit; tabel di bawah ini hanya untuk yang ingin paham "di balik layar".

## Aturan terjemahan otomatis

| Catatan pengurus | Debit | Kredit |
|---|---|---|
| Pemasukan usaha Rp X | Kas (111000) | Pendapatan unit (41x) |
| Pemasukan lewat bank | Bank BRI (112100) | Pendapatan unit (41x) |
| Pengeluaran operasional Rp X | Beban Operasional (510000) | Kas (111000) |
| Belanja stok barang dagangan | Persediaan (114000) | Kas (111000) |
| Barang dagangan terjual | Kas (111000) | Pendapatan Penjualan (410000) |
| Anggota bayar simpanan pokok | Kas (111000) | Simpanan Pokok (310000) |
| Anggota bayar simpanan wajib | Kas (111000) | Simpanan Wajib (320000) |

Membaca tabel: "Debit Kas" artinya uang kas bertambah; "Kredit Kas" artinya kas
berkurang. Pendapatan dan simpanan bertambah di sisi kredit.

## Kenapa harus jurnal ganda?

1. **Anti selisih** — karena dua sisi wajib sama, kesalahan ketik langsung ketahuan.
2. **Laporan RAT otomatis** — Buku Besar, Neraca Saldo, PHU, dan Neraca tinggal
   dihitung dari jurnal; tidak perlu rekap ulang manual di akhir tahun.
3. **Standar CORE/SIMKOPDES** — format yang sama dengan aplikasi resmi Koperasi
   Merah Putih, jadi data bisa dipertanggungjawabkan ke pembina/dinas.

## Alur pencatatan yang aman (di Kopra)

1. Pengurus menulis transaksi lewat chat WhatsApp dengan bahasa biasa.
2. Sistem menampilkan **draft**: jenis, nominal, unit usaha, kas/bank, tanggal.
3. Pengurus memeriksa lalu membalas **YA** (simpan) atau **BATAL**; salah angka
   tinggal dikoreksi ("eh 450rb") sebelum konfirmasi.
4. Setelah tersimpan (CONFIRMED), jurnal **tidak bisa diubah diam-diam** —
   koreksi dilakukan dengan jurnal baru, jejaknya tersimpan (audit).

## Nomor jurnal

Setiap catatan tersimpan mendapat nomor urut per koperasi (JU-001, JU-002, …).
Nomor ini yang dirujuk saat memeriksa Buku Besar atau saat RAT.

## Penjualan stok = dua catatan sekaligus

Satu chat "kejual MinyaKita 5" otomatis menjadi: (1) kartu stok berkurang 5, dan
(2) jurnal kas bertambah dari pendapatan penjualan — keduanya dikonfirmasi sekali.
Dengan begitu stok fisik dan pembukuan tidak pernah "jalan sendiri-sendiri".
