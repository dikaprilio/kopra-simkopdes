---
title: Panduan Praktis — Dari Buku Kas ke Jurnal (Pembukuan Koperasi Sederhana)
sourceType: guide
source: disusun tim Kopra dari standar akuntansi koperasi & format buku kas KDMP di lapangan; posting rules & alur konfirmasi sejalan aplikasi Kopra dan CORE/SIMKOPDES
year: 2026
accessed: 2026-07-10
relevance: cara mencatat harian — buku kas, double-entry sederhana, jurnal 2 baris, koreksi kesalahan lewat jurnal balik
---

# Dari Buku Kas ke Jurnal — Pembukuan Koperasi Sederhana

## 1. Tiga buku yang biasa dipakai KDMP

Praktik lapangan KDMP umumnya memakai tiga buku pencatatan uang (format resmi suite KDMP juga memakai ini):

1. **Buku Kas Umum** — semua uang masuk/keluar koperasi (ringkasan seluruh kas).
2. **Buku Kas Operasional** — kas kecil harian per gerai/kegiatan (listrik, transport, dll.).
3. **Buku Bank** — mutasi rekening bank koperasi (setoran, tarikan, transfer, bunga, admin).

Format kolom yang lazim: **Tanggal | Uraian | Masuk (Debit) | Keluar (Kredit) | Saldo**.

Aturan disiplin harian:
- Catat **setiap transaksi di hari yang sama**, jangan dirapel mingguan (sumber selisih paling umum).
- Simpan **bukti transaksi** (nota, kuitansi, struk transfer) dan beri nomor urut yang dirujuk di kolom uraian.
- Saldo buku kas harus **sama dengan uang fisik** di laci/brankas — hitung fisik (opname kas) rutin, minimal mingguan.
- Saldo buku bank dicocokkan dengan mutasi rekening (rekonsiliasi) tiap akhir bulan.

## 2. Dari buku kas ke jurnal: kenapa perlu?

Buku kas hanya menjawab "uang berapa, ke mana". Ia **tidak bisa** menghasilkan neraca dan laba rugi, karena tidak mencatat sisi kedua dari tiap transaksi (barangnya, utangnya, modalnya). Di situlah **jurnal double-entry** masuk: setiap transaksi dicatat di **dua sisi — debit dan kredit — dengan jumlah yang sama** (balance).

Cara berpikir cepat sisi debit/kredit:
- **Debit** = apa yang bertambah di sisi kekayaan/beban (kas masuk, persediaan bertambah, beban muncul).
- **Kredit** = sumbernya (pendapatan, utang bertambah, modal bertambah, atau kas keluar).

## 3. Pola jurnal 2 baris untuk transaksi harian KDMP

Hampir semua transaksi harian koperasi cukup dengan **jurnal 2 baris**. Pola bakunya:

| Transaksi | Debit | Kredit |
|---|---|---|
| Penjualan tunai (sembako/gas/pupuk) | Kas | Pendapatan penjualan |
| (otomatis mengikuti penjualan) | HPP (beban pokok) | Persediaan |
| Kulakan/beli stok tunai | Persediaan | Kas |
| Kulakan secara utang ke pemasok | Persediaan | Utang usaha |
| Bayar utang pemasok | Utang usaha | Kas |
| Bayar listrik/gaji/transport | Beban operasional (rinciannya) | Kas |
| Beli peralatan (kulkas, etalase) | Aset tetap — peralatan | Kas |
| Terima simpanan pokok/wajib anggota | Kas | Simpanan pokok/wajib (ekuitas) |
| Pencairan pinjaman LPDB/bank | Kas/Bank | Utang pinjaman |
| Bayar angsuran pinjaman (pokok) | Utang pinjaman | Kas |
| Bayar bunga pinjaman | Beban bunga | Kas |
| Setor kas ke bank | Bank | Kas |
| Tarik tunai dari bank | Kas | Bank |
| Terima jasa/komisi (BRILink, logistik) | Kas | Pendapatan jasa |

Contoh nyata: gerai menjual 5 galon air Rp 100.000 (modal kulakannya Rp 80.000):
1. `Debit Kas 100.000 / Kredit Pendapatan Penjualan 100.000`
2. `Debit HPP 80.000 / Kredit Persediaan 80.000`

Dua jurnal itu sekaligus memberi tahu: omzet 100 ribu, laba kotor 20 ribu, stok berkurang 80 ribu.

Kode akun yang lazim (COA CORE): Kas 111000 · Bank BRI 112100 · Persediaan 114000 · Simpanan Pokok 310000 · Simpanan Wajib 320000 · Pendapatan 410000/41x per unit · Beban Operasional 510000/5xx.

Kenapa wajib jurnal ganda? (1) **anti selisih** — dua sisi wajib sama, salah ketik langsung ketahuan; (2) **laporan RAT otomatis** — buku besar, neraca saldo, PHU, neraca tinggal dihitung dari jurnal; (3) **standar CORE/SIMKOPDES** — format sama dengan aplikasi resmi KDMP, data bisa dipertanggungjawabkan ke pembina/dinas.

## 4. Status catatan: draft vs terkonfirmasi

Praktik baik (dipakai juga oleh sistem digital koperasi): pencatatan melewati dua tahap —
- **DRAFT** — masih boleh diubah/dihapus selama belum dikonfirmasi.
- **CONFIRMED (terkonfirmasi/dibukukan)** — mengunci angka; **tidak boleh diedit atau dihapus lagi**.

Kenapa dikunci? Supaya jejak audit utuh — laporan yang sudah dibaca RAT/pengawas tidak bisa berubah diam-diam.

Alur pencatatan di Kopra (lewat WhatsApp): pengurus menulis dengan bahasa biasa ("catat pemasukan banyu 500rb") → sistem menerjemahkan lewat posting rules dan menampilkan **draft** (jenis, nominal, unit usaha, kas/bank, tanggal) → pengurus membalas **YA** (simpan) atau **BATAL**; salah angka tinggal dikoreksi ("eh 450rb") sebelum konfirmasi. Setiap jurnal tersimpan mendapat **nomor urut per koperasi (JU-001, JU-002, …)** yang dirujuk saat memeriksa buku besar atau saat RAT. Penjualan stok jadi **dua catatan sekaligus** dalam satu konfirmasi: kartu stok berkurang + jurnal pendapatan — stok fisik dan pembukuan tidak pernah jalan sendiri-sendiri.

## 5. Salah catat? Koreksi lewat JURNAL BALIK, bukan edit/hapus

Kalau transaksi yang sudah terkonfirmasi ternyata salah, **jangan mengedit atau menghapus** catatan lama. Buat **jurnal balik (jurnal koreksi)**: jurnal baru yang membalik posisi debit-kredit jurnal yang salah, lalu catat jurnal yang benar.

Contoh: tanggal 5 tercatat "beban listrik Rp 530.000" padahal seharusnya Rp 350.000.
1. **Jurnal balik** (membatalkan yang salah): `Debit Kas 530.000 / Kredit Beban Listrik 530.000` — uraian: "koreksi jurnal no. X".
2. **Jurnal benar**: `Debit Beban Listrik 350.000 / Kredit Kas 350.000`.

Hasilnya: saldo akhir benar, dan ketiga catatan (salah → balik → benar) tetap terlihat di buku — auditor/pengawas bisa menelusuri apa yang terjadi. Ini standar akuntansi yang berlaku umum dan jawaban yang benar bila pengawas/juri menanyakan "bagaimana koreksi transaksi yang sudah dibukukan?"

## 6. Dari jurnal ke laporan

Semua laporan diturunkan dari kumpulan baris jurnal — tidak ada angka yang diketik manual:
- **Buku besar** = kumpulan jurnal dikelompokkan per akun.
- **Neraca saldo** = daftar saldo semua akun (total debit harus = total kredit; kalau tidak balance, ada jurnal yang salah).
- **PHU/laba rugi** = akun pendapatan − HPP − beban.
- **Neraca** = akun aset, liabilitas (utang), ekuitas (simpanan, cadangan, SHU).
- **Buku kas** = tampilan mutasi akun Kas/Bank.

Urutannya selalu: **bukti transaksi → jurnal → buku besar → laporan**. Kalau angka laporan diragukan, telusuri mundur ke jurnal dan buktinya.
