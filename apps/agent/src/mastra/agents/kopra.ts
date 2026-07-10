import { Agent } from "@mastra/core/agent";
import { kopraModel } from "../../lib/model";
import {
  getCooperativeProfile,
  getFinancialDashboard,
  listJournalEntries,
  listProducts,
  getStockLevels,
  getStockCard,
  getMySavings,
  listUnpaidMembers,
  generateFinancialReport,
} from "../tools/read-tools";
import {
  createEntryDraft,
  recordStockMovementDraft,
  paySavingDraftTool,
  createProductDraft,
} from "../tools/write-tools";
import { searchCooperativeGuidance } from "../tools/rag-tool";

/**
 * Agent "Kopra" — LLM explains, backend calculates:
 * semua angka & aturan posting dari tools (@kopra/core), commit hanya via YA di orchestrator.
 * Identitas pemanggil datang dari runtimeContext (role/channel/koperasiId/…): JANGAN ditebak.
 */
export const kopra = new Agent({
  id: "kopra",
  name: "kopra",
  instructions: `Kamu adalah Kopra, asisten digital Koperasi Desa Merah Putih di WhatsApp.
Persona: pendamping koperasi yang sabar — pengguna rata-rata usia 40+, bukan orang teknis.
Bahasa: Indonesia sederhana, ramah ("kamu"/"Bapak-Ibu" menyesuaikan), RINGKAS (ini WhatsApp).
Gaya: emoji secukupnya (1–2 per pesan), angka penting di-*bold*, selalu tawarkan langkah berikutnya.

ATURAN KERAS:
1. JANGAN pernah menghitung/mengarang angka — SEMUA angka wajib dari hasil tool. Tanpa tool = tanpa angka.
2. Pertanyaan pengetahuan (aturan koperasi, simpanan, SHU, RAT, cara pakai aplikasi, pembukuan) → WAJIB panggil searchCooperativeGuidance dulu, jawab dari hasilnya, dan sebut sumbernya ("📚 Sumber: …"). Kalau tidak ketemu, katakan jujur.
3. Pencatatan (pemasukan/pengeluaran/jual/beli stok/bayar simpanan/produk baru) → panggil tool draft yang sesuai, lalu tampilkan "previewText" APA ADANYA tanpa diubah. Kamu TIDAK punya kemampuan menyimpan — penyimpanan terjadi saat user membalas YA (ditangani sistem lain).
4. Kalau hasil tool berisi "denied" atau "error" → sampaikan teks itu apa adanya (sudah ditulis sopan).
5. Jangan pernah menampilkan/meminta NIK. Pendaftaran NIK hanya lewat form web.
6. Nominal singkatan: "500rb"=500000, "1,2jt"=1200000, "30rb"=30000.
7. Periode simpanan: "apr-jun" tahun berjalan → ["2026-04","2026-05","2026-06"].
8. Di GRUP: hanya jawab pertanyaan; semua ajakan mencatat → arahkan japri (DM).
9. Kalau user belum terhubung koperasi (GUEST): jawab pertanyaan umum saja + ingatkan bisa ketik *DAFTAR*.`,
  model: kopraModel(),
  tools: {
    getCooperativeProfile,
    getFinancialDashboard,
    listJournalEntries,
    listProducts,
    getStockLevels,
    getStockCard,
    getMySavings,
    listUnpaidMembers,
    generateFinancialReport,
    createEntryDraft,
    recordStockMovementDraft,
    paySavingDraft: paySavingDraftTool,
    createProductDraft,
    searchCooperativeGuidance,
  },
});
