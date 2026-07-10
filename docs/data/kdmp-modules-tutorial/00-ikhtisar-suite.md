---
title: "Simkopdes Modules — Ikhtisar Suite & Daftar Istilah (KDMP)"
title_en: "Simkopdes Modules — Suite Overview & Glossary"
doc_role: index
description: "Indeks dan konteks bersama untuk empat aplikasi koperasi. Dokumen per-modul: 01 (CORE/Finance), 02 (Warehouse/Gudang), 03 (KDMP Mobile/Anggota), 04 (POS System)."
language: id
applications:
  - Koperasi Merah Putih CORE (Finance / Accounting back-office)
  - Warehouse App (Inventory / Gudang)
  - KDMP Mobile (Member / Anggota)
  - POS System (Point of Sale / Kasir)
rag_note: "Dokumen markdown ini mandiri (self-contained) dan cukup untuk RAG. Berkas sumber (video .mp4/.mov dan manual PDF) hanya rujukan provenance; karena ukurannya besar, sumber TIDAK perlu diindeks ke RAG — seluruh isi relevan sudah disalin ke dokumen markdown."
generated: 2026-07-10
---

# Simkopdes Modules — Ikhtisar Suite

> **Cara pakai berkas.** Basis pengetahuan ini dipecah **satu berkas per modul**. Setiap berkas modul bersifat mandiri (memuat konteks suite, istilah, dan batasannya sendiri) sehingga cukup diindeks sendiri ke RAG:
>
> | Berkas | Modul | Aplikasi |
> |---|---|---|
> | `01-koperasi-merah-putih-core.md` | Keuangan / Akuntansi | Koperasi Merah Putih CORE |
> | `02-warehouse-app-gudang.md` | Gudang / Inventory | Warehouse App |
> | `03-kdmp-mobile-anggota.md` | Anggota | KDMP Mobile |
> | `04-pos-system.md` | Kasir / Point of Sale | POS System |

> **Catatan penamaan.** Nama "Simkopdes" hanya muncul sebagai nama folder; tidak ada satu pun berkas sumber yang menyebutnya. Keempat aplikasi diperlakukan sebagai **aplikasi terpisah yang melayani satu koperasi yang sama**, bukan modul dari satu produk bernama Simkopdes. Nama produk yang benar-benar tampil di layar: *Koperasi Merah Putih*, *Warehouse App*, *KDMP Mobile*, dan *POS System*.

> **Sumber vs. RAG.** Isi tiap dokumen disusun dari **video tutorial** (transkrip audio + pembacaan bingkai) dan **buku manual PDF**. Kedua jenis sumber itu berukuran besar dan **tidak perlu dimasukkan ke RAG**; dokumen markdown sudah memuat seluruh informasi yang diperlukan.

---

## Ikhtisar Suite (Suite Overview)

**Konteks:** Dokumen induk. Berlaku untuk seluruh aplikasi.

Empat aplikasi mendukung operasional sebuah **Koperasi Desa Merah Putih (KDMP)**:

| Aplikasi | Pengguna | Fungsi utama | Bahasa UI | Berkas |
|---|---|---|---|---|
| **Koperasi Merah Putih CORE** | Pengurus koperasi | Akuntansi (COA, jurnal), data anggota & pengurus, laporan keuangan, persetujuan pinjaman | Indonesia | `01-…core.md` |
| **Warehouse App** (Aplikasi Gudang) | Staf & kepala gudang | Pendaftaran gudang, barang masuk/keluar, pemindahan antar bin, pemantauan & perhitungan stok | Indonesia | `02-…gudang.md` |
| **KDMP Mobile** | Anggota koperasi | Registrasi, simpanan pokok & wajib, pinjaman & angsuran, PPOB, profil | Indonesia | `03-…anggota.md` |
| **POS System** | Kasir / administrator toko | Katalog produk, transaksi penjualan, promosi, laporan penjualan | Inggris | `04-…pos-system.md` |

**Benang merah antar aplikasi (cross-cutting facts):**

- **Payment gateway:** Xendit dipakai oleh KDMP Mobile dan POS System. Halaman pembayaran POS bermerek **PT. Subaga Digital Kreatif** dan berlabel *Powered by Xendit*.
- **Vendor:** KDMP Mobile menampilkan *"by subaga-milenia"*. Domain surel pengurus: `@kdmp.id`.
- **Pola persetujuan:** hampir semua tugas di Warehouse App memakai pasangan tombol **Terima / Tolak** sebelum tugas berjalan.
- **Kualitas barang** (Warehouse App) selalu salah satu dari: **Inventaris**, **Karantina**, **Rusak**.
- **Metode pembayaran anggota:** Virtual Account, QRIS, E-Wallet.
- **Hubungan pinjaman:** anggota mengajukan pinjaman di **KDMP Mobile**; pengurus meninjau & menyetujuinya di **Koperasi Merah Putih CORE** (menu *Pinjaman*).

---

## Daftar Istilah Lengkap (Glossary, ID → EN)

**Konteks:** Berlaku untuk seluruh aplikasi. Tiap berkas modul juga memuat subset istilah yang relevan bagi modulnya.

| Istilah (ID) | Padanan (EN) | Makna singkat |
|---|---|---|
| Anggota | Member | Anggota koperasi |
| Pengurus | Officer / management | Pengelola koperasi yang memakai aplikasi CORE |
| Simpanan Pokok | Principal / initial savings | Dibayar **sekali** saat mendaftar; nominal tetap; dikembalikan bila keanggotaan berakhir |
| Simpanan Wajib | Mandatory monthly savings | Dibayar tiap bulan; nominal diatur tiap koperasi |
| Pinjaman | Loan | Pengajuan kredit oleh anggota |
| Angsuran | Installment | Cicilan bulanan pinjaman |
| Penjamin | Guarantor | Penjamin pinjaman anggota |
| Tenor / Jangka Waktu | Term (months) | Lama pinjaman dalam bulan |
| Bunga | Interest | Bunga pinjaman |
| Jatuh Tempo | Due date | Tanggal jatuh tempo |
| COA / Bagan Akun | Chart of Accounts | Daftar sistematis akun keuangan |
| Jurnal | Journal | Catatan transaksi kronologis |
| Akun Induk | Parent account | Klasifikasi hirarki akun |
| Buku Besar | General ledger | Ringkasan saldo akhir tiap akun |
| Neraca Saldo | Trial balance | Daftar saldo debit & kredit tiap akun |
| PHU (Partisipasi Hasil Usaha) | Income statement / P&L | Laporan laba rugi koperasi |
| Neraca | Balance sheet | Posisi keuangan pada tanggal tertentu |
| Gudang | Warehouse | |
| Barang Masuk | Inbound / goods receipt | |
| Barang Keluar | Outbound / goods issue | |
| Pemindahan Antar Bin | Bin-to-bin transfer | Pindah barang di dalam satu gudang |
| Bin | Bin / storage location | |
| Inventaris | Inventory (good stock) | Barang berkualitas baik |
| Karantina | Quarantine | Barang yang masih perlu pemeriksaan lanjutan |
| Rusak | Damaged | Barang rusak |
| SKU / Kode Barang | SKU / item code | |
| Kode Batch | Batch code | Opsional |
| Tanggal Kedaluwarsa | Expiry date | Opsional |
| Kuantitas | Quantity | |
| Kartu Stok | Stock card | Berkas Excel mutasi keluar-masuk barang |
| Pemantauan Stok | Stock monitoring | |
| Perhitungan Stok | Stock count / stock opname | Cocokkan stok fisik vs stok sistem |
| Perhitungan Berkala | Cycle count | Hitung SKU tertentu, sewaktu-waktu |
| Perhitungan Menyeluruh | Full stock count | Hitung semua SKU, mis. bulanan |
| Permintaan Baru | New request | Status awal tugas |
| Berlangsung | In progress | |
| Penentuan | Adjudication | Perlu perhitungan ke-3 karena hasil 1 ≠ 2 |
| Selesai | Completed | |
| Ditolak | Rejected | |
| Terima / Tolak | Accept / Reject | |
| Mutasi | Stock movement | Positif = masuk, negatif = keluar |
| Saldo | Balance | |
| NIAK | Member number | Nomor anggota koperasi |
| PPOB | Bill payment services | Pulsa, paket data, listrik, e-wallet, BPJS |

---

## Kesenjangan & Batasan Suite (Suite-Level Gaps)

**Konteks:** Metadata agar sistem RAG tidak mengarang jawaban lintas-aplikasi. Batasan spesifik per modul ada di masing-masing berkas.

1. **Hubungan teknis antar aplikasi.** Tidak ada sumber yang menjelaskan apakah keempat aplikasi berbagi basis data, SSO, atau sinkronisasi stok (mis. apakah *Warehouse* di POS System adalah Warehouse App yang sama).
2. **URL aplikasi** selain KDMP Mobile. Hanya `https://member.kdmp.id/` yang tercantum; URL Warehouse App, POS System, dan Koperasi Merah Putih CORE tidak pernah ditampilkan.
3. **Ketentuan yang mengikat.** Semua angka (Rp 50.000 simpanan pokok, Rp 25.000 simpanan wajib, bunga 12%, pajak 11%) berasal dari **data contoh/demo**. Sumber menegaskan **regulasi tiap koperasi berbeda-beda**.
4. **Nama "Simkopdes"** tidak muncul di berkas mana pun; hanya nama folder.

**Catatan mutu sumber:**

- Modul **Finance (CORE)** dan **POS** **tidak memiliki dokumen tertulis**; seluruh isinya berasal dari **video** (transkrip audio + pembacaan bingkai).
- PDF **Warehouse App** adalah dek salindia; beberapa detail hanya ada di tangkapan layar, bukan di lapisan teks.
- Transkrip video dihasilkan otomatis (Whisper) dan mengandung sedikit salah dengar istilah teknis; sudah dinormalkan dalam dokumen ini.
