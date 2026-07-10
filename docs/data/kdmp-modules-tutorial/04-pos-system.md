---
title: "POS System — Modul Kasir/Point of Sale (Basis Pengetahuan)"
title_en: "POS System — Point of Sale Module"
doc_role: module
module: Point of Sale (Kasir)
application: POS System
part_of_suite: "Simkopdes Modules (KDMP) — 4 aplikasi; lihat 00-ikhtisar-suite.md"
language: id
ui_language: en
sources:
  - "POS/POS System.mp4 (01:43, narasi Indonesia, UI berbahasa Inggris)"
source_note: "Modul ini tidak memiliki manual PDF; seluruh isi berasal dari transkrip audio + pembacaan bingkai video."
rag_note: "Dokumen mandiri (self-contained). Berkas video sumber TIDAK perlu diindeks ke RAG karena ukurannya besar; seluruh isi relevan sudah disalin ke sini."
generated: 2026-07-10
---

# POS System (Point of Sale)

> **Konteks suite.** Aplikasi ini adalah **satu dari empat** aplikasi terpisah yang melayani sebuah **Koperasi Desa Merah Putih (KDMP)**: Koperasi Merah Putih CORE, Warehouse App, KDMP Mobile, dan POS System (modul ini). Nama "Simkopdes" hanya nama folder. Ikhtisar suite ada di `00-ikhtisar-suite.md`.
>
> **Sumber vs. RAG.** Isi modul ini disusun dari video `POS/POS System.mp4`. Video itu berukuran besar dan **tidak perlu diindeks ke RAG** — dokumen ini sudah mandiri.
>
> **Catatan bahasa:** antarmuka POS System berbahasa **Inggris** (dengan pemilih bahasa `EN`), berbeda dari tiga aplikasi lainnya. Subtitel video bersifat dwibahasa.

## Istilah Relevan (Glossary subset)

| Istilah (UI, EN) | Padanan (ID) | Makna singkat |
|---|---|---|
| POS Terminal | Terminal kasir | Layar pemrosesan penjualan |
| Products / Categories | Produk / Kategori | Katalog barang jualan |
| Shopping Cart | Keranjang | Daftar item transaksi berjalan |
| Tax (11%) | Pajak | Dihitung dari subtotal |
| Complete Sale | Selesaikan penjualan | Memicu halaman pembayaran Xendit |
| Reports | Laporan | Laporan bisnis & analitik |

---

## POS — Login (Sign In)

**Aplikasi:** POS System
**Menu:** Sign in
**Sumber:** `POS/POS System.mp4`

Halaman **"Sign in to POS System"** — *Enter your credentials to access the system*:

- **Email address**
- **Password**
- Tombol **Sign in**
- Opsi masuk dengan **SSO**

**Temuan kualitas (bukan instruksi pengguna):**

- Dua label pada halaman login **tidak diterjemahkan** dan menampilkan kunci i18n mentah: `login.orContinueWith` dan `login.signInWithSso`.
- Halaman login **menampilkan kredensial default** (`admin@possystem.com` dengan kata sandi yang tampak di layar; **kata sandi sengaja tidak dicatat di dokumen ini**). Kredensial demo yang tampil permanen di layar login sebaiknya ditinjau sebelum rilis produksi.

Pengguna yang dipakai dalam demo adalah **System Administrator** dengan peran **Administrator**.

## POS — Navigasi (Navigation)

**Aplikasi:** POS System
**Sumber:** `POS/POS System.mp4`

Menu sisi kiri:

- **Dashboard**
- **POS Terminal**
- **Products**
- **Categories**
- **Customers**
- **User Management**
- **Warehouse**
- *INVENTORY* → **Stock Movement**
- *OTHER* → **Promotions**, **Reports**

> **Belum terdokumentasi:** Dashboard, Customers, User Management, Warehouse, Stock Movement, dan Promotions **tidak didemonstrasikan** dalam video.

## POS — Categories (Kategori Produk)

**Aplikasi:** POS System
**Menu:** Categories
**Sumber:** `POS/POS System.mp4`

Halaman **Category Management** — *Manage product categories and classifications*.

- Kotak pencarian: *Search categories by name or description…*
- Penyaring **Active Only**, tombol **Refresh**
- Tombol **+ Add New Category** di kanan atas → isi kolom yang tersedia

Tiap kategori tampil sebagai kartu berisi **nama**, lencana **Active**, **deskripsi** (atau *No description provided*), tanggal **Created**, dan tombol **Edit**. Contoh: `Elektronik`, `Makanan Ringan`.

## POS — Products (Produk)

**Aplikasi:** POS System
**Menu:** Products
**Sumber:** `POS/POS System.mp4`

Halaman **Product Management** — *Manage your product catalog and inventory*.

- Pencarian: *Search products by name, code, or barcode…*
- Penyaring **Low Stock Only**, tombol **Refresh**
- Tombol **+ Add New Product** → isi kolom yang tersedia

Kartu produk menampilkan gambar, nama, deskripsi, **Code**, **Category**, **Unit** (mis. `PCS`), **Selling Price**, **Cost Price**, lencana **Stock**, dan tombol **Edit**.

## POS — POS Terminal (Transaksi Penjualan)

**Aplikasi:** POS System
**Menu:** POS Terminal
**Sumber:** `POS/POS System.mp4`

Halaman **POS Terminal** — *Process sales and transactions*. Terdapat dua tab: **POS Terminal** dan **Transactions**.

**Kolom kiri:**

- **Search Products** — cari berdasarkan nama atau kode, tombol **Search**
- **Quick Add by Barcode** — pindai atau ketik barcode, tombol **Add**
- **Best Sellers**
- **Shopping Cart** — daftar item dengan pengatur kuantitas (`-` / `+`) dan tombol hapus (`×`); tombol **Hold** dan **Clear**

**Kolom kanan:**

- **Customer** — *Search customer…*
- **Promotion** — *Enter promotion code…* + tombol **Apply**
- **Summary** — **Subtotal**, **Tax (11%)**, **Total**
- **Payment** — **Payment Method** (mis. `Pembayaran Online (Xendit Payment Link)`), lalu tombol **Complete Sale**

**Pajak** dihitung `11%` dari subtotal (contoh: Subtotal `Rp 1.000.000` + Tax `Rp 110.000` = Total `Rp 1.110.000`).

## POS — Halaman Pembayaran Xendit (Checkout)

**Aplikasi:** POS System → halaman pembayaran Xendit
**Sumber:** `POS/POS System.mp4`

Setelah **Complete Sale**, pembeli diarahkan ke **halaman pembayaran yang dihosting Xendit** (*Powered by Xendit*), bermerek **PT. Subaga Digital Kreatif**, dengan pemilih bahasa (*English*).

- **Invoice #** — format contoh: `TOKO001-20251020-0007`
- **Description** — *Pembayaran untuk Transaksi `<invoice>`*
- **PAY BEFORE `<tanggal & jam>`** — batas waktu pembayaran (contoh menunjukkan tenggat **keesokan harinya**)
- **Total Amount Due** — mis. `IDR 1.110.000`

**PAYMENT METHOD** yang tersedia:

| Kelompok | Contoh penyedia yang tampil |
|---|---|
| **Bank Transfer** | BNI, BSI, dan lainnya (`+6`) |
| **Retail Outlet** | gerai ritel |
| **E-Wallet** | AstraPay, DANA |
| **QR Payments** | QRIS |

## POS — Reports (Laporan)

**Aplikasi:** POS System
**Menu:** Reports
**Sumber:** `POS/POS System.mp4`

Halaman **Reports** — *View business reports and analytics*, dengan tombol **Refresh**.

**Report Type** (delapan jenis laporan):

1. **Dashboard Metrics**
2. **Penjualan Harian** (daily sales)
3. **Penjualan Produk** (product sales)
4. **Performa Kasir** (cashier performance)
5. **Produk Terlaris** (best-selling products)
6. **Margin Keuntungan** (profit margin)
7. **Perubahan Stok** (stock changes)
8. **Ringkasan Penjualan** (sales summary)

**Report Parameters:** **Start Date** dan **End Date**, lalu tombol **Generate Report**. Hasil ditampilkan di panel bawah dengan nama laporan dan waktu pembuatannya (*Generated on …*).

---

## Kesenjangan & Batasan Modul (Gaps — POS System)

**Konteks:** Metadata agar RAG tidak mengarang jawaban.

1. **Modul ini tidak memiliki manual PDF**; seluruh isi berasal dari transkrip audio + pembacaan bingkai video.
2. **Modul yang tidak didemonstrasikan:** Dashboard, Customers, User Management, Warehouse, Stock Movement, Promotions.
3. **Kredensial default** yang tampil di layar login (`admin@possystem.com`) sebaiknya ditinjau; kata sandi sengaja tidak dicatat.
4. **Dua kunci i18n** (`login.orContinueWith`, `login.signInWithSso`) belum diterjemahkan — temuan mutu, bukan fitur.
5. **URL aplikasi POS** tidak pernah ditampilkan.
6. **Hubungan "Warehouse" di POS** dengan Warehouse App tersendiri tidak dijelaskan di sumber mana pun.
7. Semua angka (pajak 11%, contoh nominal transaksi) adalah **data demo**.
