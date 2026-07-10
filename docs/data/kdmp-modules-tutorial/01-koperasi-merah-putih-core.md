---
title: "Koperasi Merah Putih CORE — Modul Keuangan/Akuntansi (Basis Pengetahuan)"
title_en: "Koperasi Merah Putih CORE — Finance / Accounting Module"
doc_role: module
module: CORE (Finance / Accounting)
application: Koperasi Merah Putih CORE
part_of_suite: "Simkopdes Modules (KDMP) — 4 aplikasi; lihat 00-ikhtisar-suite.md"
language: id
sources:
  - "Finance/Koperasi_CORE.mp4 (06:41, narasi Indonesia)"
source_note: "Modul ini tidak memiliki manual PDF; seluruh isi berasal dari transkrip audio + pembacaan bingkai video."
rag_note: "Dokumen mandiri (self-contained). Berkas video sumber TIDAK perlu diindeks ke RAG karena ukurannya besar; seluruh isi relevan sudah disalin ke sini."
generated: 2026-07-10
---

# Koperasi Merah Putih CORE (Finance / Accounting)

> **Konteks suite.** Aplikasi ini adalah **satu dari empat** aplikasi terpisah yang melayani sebuah **Koperasi Desa Merah Putih (KDMP)**: Koperasi Merah Putih CORE (modul ini), Warehouse App, KDMP Mobile, dan POS System. Nama "Simkopdes" hanya nama folder, bukan nama produk. Ikhtisar suite ada di `00-ikhtisar-suite.md`.
>
> **Sumber vs. RAG.** Isi modul ini disusun dari video `Finance/Koperasi_CORE.mp4`. Video itu berukuran besar dan **tidak perlu diindeks ke RAG** — dokumen ini sudah mandiri.

## Istilah Relevan (Glossary subset)

| Istilah (ID) | Padanan (EN) | Makna singkat |
|---|---|---|
| Pengurus | Officer / management | Pengelola koperasi yang memakai aplikasi CORE |
| COA / Bagan Akun | Chart of Accounts | Daftar sistematis akun keuangan |
| Jurnal | Journal | Catatan transaksi kronologis |
| Akun Induk | Parent account | Klasifikasi hirarki akun |
| Buku Besar | General ledger | Ringkasan saldo akhir tiap akun |
| Neraca Saldo | Trial balance | Daftar saldo debit & kredit tiap akun |
| PHU (Partisipasi Hasil Usaha) | Income statement / P&L | Laporan laba rugi koperasi |
| Neraca | Balance sheet | Posisi keuangan pada tanggal tertentu |
| Anggota | Member | Anggota koperasi |
| Pinjaman | Loan | Pengajuan kredit oleh anggota (diajukan lewat KDMP Mobile) |

---

## CORE — Ikhtisar & Navigasi (Overview & Navigation)

**Aplikasi:** Koperasi Merah Putih CORE (back-office keuangan)
**Sumber:** `Finance/Koperasi_CORE.mp4`

Aplikasi web back-office yang dipakai **pengurus koperasi**. Masuk dengan **alamat email dan password** yang sudah terdaftar.

Menu navigasi kiri:

- **Dashboard**
- **Akuntansi** → `COA`, `Jurnal`
- **Pinjaman**
- **Master Data** → `Anggota`, `Pengurus`
- **Laporan** → `Buku Besar`, `Neraca Saldo`, `PHU`, `Neraca`

## CORE — Dashboard

**Aplikasi:** Koperasi Merah Putih CORE
**Menu:** Dashboard
**Sumber:** `Finance/Koperasi_CORE.mp4`

Dashboard menyapa dengan *"Selamat datang di Koperasi Merah Putih"* dan menampilkan kartu ringkasan serta aksi cepat ke fitur aplikasi.

Kartu KPI baris pertama: **Total Anggota** (mis. `2 aktif, 2 baru 30 hari`), **Pinjaman Aktif**, **Total Simpanan**, **Sisa Pinjaman**.

Kartu akuntansi: **Total Aset**, **Total Kewajiban**, **Total Ekuitas**, lalu **Total Pendapatan**, **Total Beban**, **Laba Bersih** (nilai negatif ditampilkan sebagai *Rugi periode ini*).

Panel ringkasan:

- **Ringkasan Anggota** — Total Anggota, Anggota Aktif, Menunggu Persetujuan, Simpanan Wajib Lunas.
- **Ringkasan Pinjaman** — Total Pinjaman, Pinjaman Aktif, Sisa Tagihan, Tingkat Pengembalian (%).
- **Ringkasan Simpanan** dan **Ringkasan Pembayaran**.

## CORE — Akuntansi > COA (Chart of Accounts)

**Aplikasi:** Koperasi Merah Putih CORE
**Menu:** Akuntansi > COA
**Sumber:** `Finance/Koperasi_CORE.mp4`

> **COA (Chart of Accounts / bagan akun)** adalah daftar sistematis dari semua akun yang digunakan untuk mencatat dan mengklasifikasikan transaksi keuangan.

Tabel COA berkolom: **Kode Akun**, **Nama Akun**, **Tipe Akun**, **Status**, **Dapat Diedit**, **Aksi**. Akun bersifat hirarkis (dapat diperluas dengan tanda `>`).

Akun induk tingkat atas yang tampil: `100000 – AKTIVA` (tipe *Asset*), `200000`, `310000`, `400000`, `500000`.

**Menambah akun — dialog "Tambah COA Baru":**

| Kolom | Wajib | Keterangan (dari narasi) |
|---|---|---|
| **Nama Akun** | ya | Nama deskriptif dari akun yang akan dibuat |
| **Kode Akun** | ya | Nomor unik pengidentifikasi akun; harus disusun sistematis agar mudah diklasifikasikan |
| **Status** | ya | Menentukan apakah akun aktif dan dapat dipakai mencatat transaksi (mis. `Aktif`) |
| **Akun Induk** | ya | Menentukan klasifikasi hirarki akun baru (mis. `100000 - AKTIVA`) |

Tombol: **Batal**, **Tambah**.

## CORE — Akuntansi > Jurnal (Journal)

**Aplikasi:** Koperasi Merah Putih CORE
**Menu:** Akuntansi > Jurnal
**Sumber:** `Finance/Koperasi_CORE.mp4`

> **Jurnal** adalah catatan akuntansi permanen untuk mencatat setiap transaksi keuangan secara kronologis berdasarkan tanggal dan sistematis.

Tabel **Daftar Jurnal** berkolom: **No. Jurnal**, **Referensi** (mis. `JU-011`), **Tanggal**, **Debit**, **Kredit**, **Aksi**. Terdapat paginasi (mis. *Menampilkan 1 – 10 dari 11 data*).

**Membuat jurnal — dialog "Buat Journal"** (tombol *Tambah Jurnal*):

| Kolom | Keterangan |
|---|---|
| **No. Jurnal** | Nomor unik jurnal. Biasanya diisi otomatis sistem (mis. `JU-012`) atau diisi manual |
| **Referensi** | Kode/nomor yang merujuk pada dokumen sumber transaksi |
| **Tanggal** | Tanggal terjadinya transaksi |
| **Keterangan** | Uraian singkat dan jelas mengenai transaksi |
| **Detail Jurnal** | Baris-baris berkolom **COA**, **Debit**, **Kredit**, **Catatan**; tambah baris dengan **+ Tambah Baris** |

Tombol: **Batal**, **Simpan**.

## CORE — Pinjaman (Loan review)

**Aplikasi:** Koperasi Merah Putih CORE
**Menu:** Pinjaman
**Sumber:** `Finance/Koperasi_CORE.mp4`

Halaman **Pinjaman** dipakai pengurus untuk menindaklanjuti **pengajuan pinjaman yang dibuat anggota** lewat KDMP Mobile — **diterima atau ditolak**.

> **Catatan sumber:** narator menyatakan halaman ini "akan menjadi *improvement*", sehingga alur rincinya **tidak didemonstrasikan** dalam video. Persetujuan di sini adalah yang membuat pinjaman muncul sebagai *Aktif* dan menghasilkan **Catatan Persetujuan** serta **Tanggal Disetujui** di sisi anggota (KDMP Mobile).

## CORE — Master Data > Anggota (Members)

**Aplikasi:** Koperasi Merah Putih CORE
**Menu:** Master Data > Anggota
**Sumber:** `Finance/Koperasi_CORE.mp4`

Fitur ini dipakai pengurus untuk **menambah, mengedit, dan menghapus** data anggota koperasi.

Tabel **Data Anggota** berkolom: **Nama Lengkap**, **NIK**, **Jenis Kelamin**, **Telepon**, **Email**, **Status** (mis. `Aktif`), **Simpanan Wajib** (mis. `Belum Lunas`), **Aksi**.

Ikon pada kolom **Aksi**:

- **Mata** → lihat detail anggota.
- **Pena** → buka form **Edit Anggota**.
- **Tempat sampah** → hapus; muncul konfirmasi, lalu **Hapus Anggota** atau **Batal**.

Menambah anggota: tombol **Tambah Anggota** → isi form sesuai identitas → **Simpan Anggota**.

**Form Edit Anggota** (scroll ke bawah untuk **Simpan Perubahan**):

- **Tanggal Lahir** *(wajib)*
- **Informasi Kontak** — Email *(wajib)*, Nomor Telepon *(wajib)*, **Password Baru (Opsional)** — *biarkan kosong jika tidak ingin mengubah password*
- **Informasi Alamat** — Alamat Lengkap, Provinsi, Kota/Kabupaten, Kecamatan, Kelurahan/Desa *(semua wajib)*
- **Informasi Lainnya** — Agama, Pendidikan, Profesi *(semua wajib)*

## CORE — Master Data > Pengurus & Peran (Officers & Roles)

**Aplikasi:** Koperasi Merah Putih CORE
**Menu:** Master Data > Pengurus
**Sumber:** `Finance/Koperasi_CORE.mp4`

Dipakai untuk menambah, mengedit, dan menghapus **pengurus yang menjalankan aplikasi Koperasi CORE**.

Tabel **Daftar Pengurus** berkolom: **Email**, **No. HP**, **Peran**, **Status**, **Dibuat**, **Aksi**.

**Menambah pengurus** — tombol **Tambah Pengurus**, isi: **Email**, **Password**, **No. HP**, **Status** (keaktifan), **Peran**. Lalu **Simpan**.

**Daftar Peran (roles) yang tersedia:**

1. **Data Analis**
2. **Finance Manager**
3. **Member Koordinator**
4. **Super Admin**
5. **Unit Manager**

**Menghapus pengurus:** pada kolom **Aksi** klik tombol **titik tiga** → **Delete** → muncul konfirmasi → **Hapus** atau **Batal**.

> **Belum terdokumentasi:** matriks hak akses tiap peran (permission per role) tidak dijelaskan di sumber mana pun.

## CORE — Laporan (Financial Reports)

**Aplikasi:** Koperasi Merah Putih CORE
**Menu:** Laporan
**Sumber:** `Finance/Koperasi_CORE.mp4`

Empat laporan tersedia:

| Laporan | Padanan EN | Fungsi (dari narasi) |
|---|---|---|
| **Buku Besar** | General ledger | Laporan akuntansi utama yang menyediakan **ringkasan saldo akhir dari setiap akun COA** koperasi; berfungsi sebagai alat kontrol untuk memverifikasi keakuratan total transaksi |
| **Neraca Saldo** | Trial balance | Menyajikan **daftar lengkap semua akun dalam buku besar** beserta saldo debit dan kredit akhirnya pada periode tertentu |
| **PHU** (Partisipasi Hasil Usaha) | Income statement / P&L | Menyajikan **kinerja keuangan** koperasi selama periode tertentu; menunjukkan total pendapatan dan total beban untuk menghitung **laba bersih atau rugi bersih** |
| **Neraca** | Balance sheet | Laporan posisi keuangan koperasi **pada suatu tanggal tertentu** |

**Halaman Neraca Saldo** memiliki **Filter Laporan** (Tanggal Mulai, Tanggal Akhir, **Reset**) dan empat kartu ringkasan: **Total Akun** (mis. `127`), **Total Debit**, **Total Kredit**, dan **Status Balance** (mis. **Neraca Seimbang** bila debit = kredit).

Tabel **Data Neraca Saldo** berkolom **Kode Akun**, **Debit**, **Kredit**, **Saldo** — contoh baris: `111000 - Kas Rupiah`, `112100 - Bank BRI`, `112200 - Bank Jabar`, `113300 - Piutang Jasa Layanan Kesehatan`, `114101 - Beras Medium`. Terdapat opsi **Tampilkan semua akun**.

---

## Kesenjangan & Batasan Modul (Gaps — CORE)

**Konteks:** Metadata agar RAG tidak mengarang jawaban.

1. **Modul ini tidak memiliki manual PDF**; seluruh isi berasal dari transkrip audio + pembacaan bingkai video. Transkrip otomatis (Whisper) sempat salah dengar istilah (mis. *"PHU"* → *"PU"*) dan sudah dinormalkan.
2. **Matriks hak akses per peran** (Data Analis, Finance Manager, Member Koordinator, Super Admin, Unit Manager) tidak dijelaskan.
3. **Alur rinci persetujuan pinjaman** tidak didemonstrasikan — narator menyebutnya sebagai area *improvement*.
4. **URL aplikasi CORE** tidak pernah ditampilkan.
5. Semua nilai keuangan yang tampil (mis. contoh COA/neraca) adalah **data demo**, bukan ketentuan koperasi mana pun.
