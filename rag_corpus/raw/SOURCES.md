# Sumber dokumen mentah korpus RAG (P2)

Diunduh 2026-07-10. PDF di folder ini adalah bahan mentah — perlu diekstrak/dikonversi ke markdown sebelum ingest (`sourceType: regulation | guide`).

| File | Judul resmi | Penerbit | Tahun | Tipe | URL sumber |
|---|---|---|---|---|---|
| `UU-25-1992-Perkoperasian.pdf` | UU No. 25 Tahun 1992 tentang Perkoperasian | Pemerintah RI (via JDIH BPK) | 1992 | regulation | https://peraturan.bpk.go.id/Details/46650/uu-no-25-tahun-1992 |
| `Inpres-9-2025-KDMP.pdf` | Inpres No. 9 Tahun 2025 tentang Percepatan Pembentukan Koperasi Desa/Kelurahan Merah Putih | Presiden RI (via JDIH BPK) | 2025 | regulation | https://peraturan.bpk.go.id/Details/316750/inpres-no-9-tahun-2025 |
| `Juklak-Menkop-1-2025-Pembentukan-KDMP.pdf` | Petunjuk Pelaksanaan Menteri Koperasi No. 1 Tahun 2025 tentang Pembentukan Koperasi Desa/Kelurahan Merah Putih | Kementerian Koperasi (JDIH Kemenkop) | 2025 | guide | https://jdih.kop.go.id/doc/detail/doc-1168-v_peraturan |
| `Panduan-Teknis-KOPDES.pdf` | Panduan Teknis KOPDES Merah Putih | kopdesa.com (non-pemerintah — verifikasi sebelum dikutip sebagai resmi) | 2025 | guide | https://kopdesa.com/download/PanduanTeknisKOPDES.pdf |

## Dokumen lapangan (OCR vision, 2026-07-10)

| File | Isi |
|---|---|
| `lpj-rat-bangunharjo-2025-transkrip.md` | Transkrip 44 hlm LPJ RAT KDMP Bangunharjo TB 2025 (scan di `Simkopdes/Berkas Koperasi Anita/`; duplikatnya `DOC-20260630-WA0000..pdf` di folder Palbapang — hash identik). Nama peserta daftar hadir dihilangkan. Termasuk catatan 7 inkonsistensi internal dokumen. Sumber `../template-laporan-rat.md` |

## pasal-id/ (diambil via MCP/API pasal.id, 2026-07-10)

| File | Isi |
|---|---|
| `pasal-id/uu-25-1992-mcp.json` | 67 pasal UU 25/1992 lengkap dengan ayat (sumber `../uu-25-1992-perkoperasian.md`) + relasi perubahan + UU 6/2023 Pasal 85 |
| `pasal-id/uu-25-1992.json` | Respons REST API `/laws` (struktur bab/pasal; 37 pasal tanpa ayat — dipakai hanya untuk kerangka) |
| `pasal-id/kdmp-extra-mcp.json` | Outline Inpres 9/2025 (teks belum diekstrak di pasal.id), UU 6/2023 Pasal 86, hasil pencarian regulasi KDMP |

Catatan:
- UU 25/1992 masih berlaku (Putusan MK No. 28/PUU-XI/2013 membatalkan UU 17/2012); beberapa ketentuan diubah UU 6/2023 (Cipta Kerja) Pasal 86.
- Teks lengkap per pasal UU 25/1992 sudah dikonversi ke `../uu-25-1992-perkoperasian.md` (siap ingest, `sourceType: regulation`).
- FAQ KDMP sudah dikonversi langsung ke `../faq-kdmp.md` (sumber: Diskop UKM Prov. Kalbar).
- Inpres 9/2025 di pasal.id belum ada teksnya — pakai PDF resmi di folder ini untuk ekstraksi.
- Regulasi KDMP pusat (Juklak Menkop, PMK 81/2025, Permendesa 10/2025, dll.) TIDAK ada di pasal.id; sumbernya tetap https://jdih.kop.go.id/doc/peraturan_kdmp — di luar scope P2 kecuali Juklak (sudah diunduh).
