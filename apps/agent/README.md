# apps/agent — Mastra (otak AI)

SUDAH di-scaffold (Fase 0.1). Perintah asal (referensi):

```bash
# dari root monorepo
pnpm create mastra@latest apps/agent
# pilih: agents + tools + workflows, provider Anthropic
npx skills add mastra-ai/skills   # docs Mastra untuk coding agents — WAJIB
```

Set `"name": "agent"`, port `AGENT_PORT` (4111). `mastra dev` = playground lokal (test agent tanpa WA!).

Isi (lihat docs/00-core-features.md §7):
- `agents/kopra.ts` — model `claude-opus-4-8`, bahasa Indonesia sederhana, TIDAK PERNAH menghitung angka sendiri
- `tools/` — 7 tools (fungsi TS + Prisma dari `@kopra/db`, semua scoped `koperasiId`):
  `createEntryDraft` (posting rules → jurnal 2-baris) · `recordStockMovement` · `getStockLevels` · `getFinancialSummary` · `listUnpaidMembers` · `generateReport` · `searchKoperasiGuides`
- `workflows/recordEntry.ts` — parseDraft → `.suspend()` (kirim konfirmasi) → resume "YA" = CONFIRMED atomik (jurnal + movement linked) / lainnya = koreksi-batal
- `rag/` — ingest korpus (`docs/../rag_corpus/` → chunk → embed → pgvector) + tool search
- Memory: Mastra Memory, storage Postgres, thread per nomor WA / per user web
- Middleware: verifikasi JWT (secret sama dengan api) untuk endpoint chat dari web
