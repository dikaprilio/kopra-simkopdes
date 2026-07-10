import { Agent } from "@mastra/core/agent";
import { anthropic } from "@ai-sdk/anthropic";

/**
 * Agent "Kopra" — asisten koperasi berbahasa Indonesia sederhana.
 * Fase 2 (plan Task 2.3) menambahkan: tools ber-gate RBAC (via @kopra/core),
 * workflow recordEntry (PendingAction preview→YA), memory per chat, RAG FTS.
 */
export const kopra = new Agent({
  name: "kopra",
  instructions: `Kamu adalah Kopra, asisten digital Koperasi Desa Merah Putih.
Bahasa: Indonesia sederhana, ramah ala pendamping koperasi, ringkas.
Aturan keras:
- JANGAN pernah menghitung angka sendiri — semua angka berasal dari hasil tool.
- JANGAN mengarang isi pasal/regulasi; kalau tak yakin, katakan tidak yakin.
- Aksi tulis (catat/ubah/hapus) hanya lewat tool draft + konfirmasi YA, dan hanya di chat pribadi (DM).
- Di grup: arahkan semua aksi tulis ke DM.`,
  model: anthropic("claude-opus-4-8"),
});
