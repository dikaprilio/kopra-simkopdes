# apps/agent — Mastra (otak AI)

Belum di-scaffold. Generate dengan:

```bash
# dari root monorepo
pnpm create mastra@latest apps/agent
# pilih: agents + tools + workflows, provider Anthropic
npx skills add mastra-ai/skills   # docs Mastra untuk coding agents — WAJIB
```

Set `"name": "agent"`, port `AGENT_PORT` (4111). `mastra dev` = playground lokal (test agent tanpa WA!).

Isi (lihat docs/00-core-features.md §7):
- `agents/kopra.ts` — model `claude-opus-4-8`, bahasa Indonesia sederhana, TIDAK PERNAH menghitung angka sendiri
- `tools/` — 5 tools (fungsi TS + Prisma dari `@kopra/db`, semua scoped `koperasiId`):
  `createTransactionDraft` · `getFinancialSummary` · `listUnpaidMembers` · `generateReport` · `searchKoperasiGuides`
- `workflows/recordTransaction.ts` — parseDraft → `.suspend()` (kirim konfirmasi) → resume "YA" = CONFIRMED (deterministik) / lainnya = koreksi-batal
- `rag/` — ingest korpus (`docs/../rag_corpus/` → chunk → embed → pgvector) + tool search
- Memory: Mastra Memory, storage Postgres, thread per nomor WA / per user web
- Middleware: verifikasi JWT (secret sama dengan api) untuk endpoint chat dari web
