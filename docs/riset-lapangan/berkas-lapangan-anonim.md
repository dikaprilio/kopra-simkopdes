# Berkas Lapangan (Versi Anonim) — Struktur & Pola Pembukuan KDMP Nyata

> Ringkasan terstruktur dari berkas asli narasumber (4 Excel KDMP Palbapang + LPJ RAT KDMP Bangunharjo 44 hal).
> Berkas mentah TIDAK di repo (berisi PII: nama anggota, tanda tangan, no. HP, alamat — lihat README).
> Nama orang di dokumen ini sudah diganti `[Anggota-N]` / `[Mitra-X]`. Angka dipertahankan karena itu pola yang harus ditiru seed & dipahami agent.

---

## A. Excel Palbapang — 4 workbook, pola umum

**Format universal semua buku:** sheet per bulan (Januari–Desember), 3 baris header (nama koperasi / judul buku / periode), lalu tabel:

| No | Tanggal | Uraian Transaksi | Bukti | Debet (Rp) | Kredit (Rp) | Saldo (Rp) | Keterangan |
|---|---|---|---|---|---|---|---|

Baris 1 tiap bulan selalu `Saldo (Kas/Bank) Bulan Lalu`. Baris akhir kadang `Transaksi Bulan ini` (total). Kolom `Bukti` hampir selalu kosong (⚠️ insight: bukti transaksi tidak terkelola).

### A1. Buku Bank (data terisi Jan–Jul 2026)
Contoh uraian nyata: `Setoran anggota` · `Simpanan Anggota` · `Simpanan Pokok Anggota` · `Laba Brilink` · `Fee Pisang` · `Transfer` · `admin bank`.
Nominal kecil-riil: setoran 100–120rb, laba Brilink Rp1.222,5, admin bank 6rb. Saldo berkisar 8–11 juta.

### A2. Buku Kas Operasional
Uraian nyata: `Print Warna dan Fotocopy Undangan` · `Pembelian Snack Temu Mitra` · `Terima diskon snack` · `Biaya Konsumsi Rapat Koordinasi` · `Biaya cetak rekening koran` · `Terima laba Mitra [Broiler]` · `Biaya Rapat Pengurus` · `Terima Laba Buku Tabungan`.
⚠️ Keunikan: ada **kolom samping tak berjudul** di kanan tabel untuk tracking `Pinjaman pihak ke-3 tahun lalu / saat ini / total / pengembalian` — pembukuan hutang ditempel manual di pinggir, bukan buku sendiri. (Pain klasifikasi yang persis disebut Pak Tedjo di interview.)

### A3. Buku Kas Umum
Uraian nyata: `Terima Simpanan wajib an [Anggota-1]` (dengan periode di Keterangan: "Juli - Des 25", "Mart - Des 26") · `Modal Unit Usaha Banew` · `Modal Mitra [Broiler]_SPP` · `Pengembalian Mitra [Broiler]` (Keterangan: "bagi hasil 100rb") · `Setor ke Bidang Usaha` · `Mengembalikan kepada pihak ke-3`.
⚠️ Ada sel `#REF!` (formula rusak) di beberapa sheet — bukti kerapuhan spreadsheet yang jadi pitch point.
⚠️ Pembayaran simpanan wajib **rapel multi-bulan** ("Juli - Des 25" = 6 bulan sekaligus 120rb) — fitur simpanan Kopra harus dukung rapel.

### A4. Laporan Unit Usaha (sheet per unit + Laba Rugi)
Sheets: `BRILINK` · `POSPAY` · `BANEW` · `GERAI KANTOR` · `MITRA SPPG` · `Agro Mandiri` · `opersional (2)` · `Laba Rugi`.
Kolom unit: `No | Tanggal | Jenis Transaksi | Masuk | Keluar | Saldo | Keterangan` (BRILINK punya kolom ekstra `Fee Brilink`).
⚠️ Kolom Tanggal campur format: datetime asli, teks "Bulan Januari", "Tgl 01 Juli 2026", bahkan typo "2028".
Transaksi khas per unit:
- BRILINK: `Pembelian pulsa`, `Tranfer brilink`, `Admin Brilink` (fee 455–2500)
- POSPAY: `Layanan Pengiriman`, `Modal dari KDMP`, `Belanja/Penjualan Materai` (laba dicatat di Keterangan: "Laba : 12000")
- BANEW (air minum): `Terima Dari Bendahara`, `Belanja Banew`, `Penjualan Banew Lembar 1`
- MITRA SPPG: `Bagi Hasil Pisang` (86–180rb/bulan)
- Agro Mandiri: `Simpanan Sukarela Anggota`, `Belanja Botol`, `Belanja Media Tanam`

**Sheet Laba Rugi (Jan–Jun 2026), struktur:**
```
A. PENDAPATAN (per unit): Mitra SPPG MBG 1.664.250 · Brilink 13.849,5 ·
   Distributor Air Mineral Banew 544.500 · Gerai Kantor 170.000
B. (beban ops: cetak buku & kartu anggota, dll — sheet "opersional (2)")
```

### Implikasi desain (untuk agent & seed)
1. Seed transaksi Kopra pakai kosakata uraian ASLI di atas — demo terasa otentik.
2. Parser WA harus paham frasa seperti "terima simpanan wajib an Bu X juli-des", "bagi hasil pisang 150rb", "laba brilink".
3. Laporan Kopra harus bisa direproduksi ke format ini (kolom sama) — "laporan yang biasa Bapak buat, sekarang otomatis".
4. Nominal realistis: puluhan ribu–jutaan, bukan ratusan juta.

---

## B. LPJ RAT KDMP Bangunharjo — outline dokumen 44 halaman (Tahun Buku 2025)

Struktur (jadi acuan template RAG "cara bikin LPJ RAT"):

1. **Cover** — "Laporan Pertanggungjawaban Pengurus … pada Rapat Anggota Tahunan Tahun Buku 2025"
2. **Undangan RAT** (kop surat, nomor `NNN/KDMPKalBH/III/2026`, dasar: Pasal 30 ayat (1) UU 25/1992; acara: RAT, pembagian kartu anggota, sosialisasi program kerja)
3. **Daftar hadir** anggota (No | Nama | Nomor Anggota | Alamat | TTD) — sumber PII, di template dikosongkan
4. **Kata pengantar** — rujuk UU 25/1992 pasal 22 ayat (1); daftar isi laporan: LPJ tahun buku, rencana kerja tahun depan, RAPBK tahun depan+1, laporan pengawas
5. **Laporan Pengurus**: bidang organisasi (susunan pengurus & pengawas), keanggotaan (186 anggota + 20 calon "belum di-approve"), **bidang usaha per gerai**:
   - Gerai Kantor (admin & operasional) · Gerai Klinik Desa (belum operasi — kendala perijinan/juknis) · Gerai Obat/Apotik (idem) · Gerai Sembako · Gerai Simpan Pinjam (belum operasi — proses channeling) · Gerai Pangkalan Gas Elpiji (sub-agen LPG 3kg, kuota 250 tabung/bulan, HET) · Gerai Pupuk (PPTS, 207 penerima manfaat via E-RDKK)
6. **Kebijakan Akuntansi** (mengaku pakai SAK): piutang nominal + penyisihan; persediaan biaya perolehan
7. **Penjelasan Laporan Keuangan** — pos bernomor (V.4 Beban Penyisihan Piutang, V.5 Beban Perkoperasian [rapat organisasi, pendidikan anggota, rapat anggota], V.6 Pendapatan & Beban Lainnya, V.7 Biaya Bunga [965.250], V.8 Biaya Pajak…). ⚠️ Banyak field `Rp. ……..` KOSONG — LPJ diisi setengah template, setengah manual.
8. **Laporan Pengawas** — dasar: UU 25/1992 Bab IV pasal 38–40; tujuan: meneliti kebenaran pembukuan/administrasi keuangan.

### Implikasi desain
1. Field `Rp ……` kosong = laporan RAT nyata dirakit manual dan tidak selesai → tool `generateReport` Kopra bisa diframe "mengisi LPJ RAT otomatis dari ledger".
2. Struktur ini = konten RAG P3 (template): jawaban untuk "cara bikin laporan RAT gimana?" mengikuti outline di atas.
3. Kasus Bangunharjo: koperasi "maju" pun punya 3 dari 7 gerai belum beroperasi karena perijinan/juknis — nuansa untuk narasi (aktivasi bukan cuma soal tools).
