# Konvensi Tim — Baca 5 Menit Sebelum Coding

## Pembagian kerja (biar tidak saling senggol)

| Dev | Wilayah | Jangan sentuh |
|---|---|---|
| Dev 1 (Dika) | `apps/api` (kecuali `src/whatsapp/`), `apps/web`, `packages/db` schema | `apps/agent` |
| Dev 2 (Aldio) | `apps/agent`, `apps/api/src/whatsapp/`, RAG corpus & ingest | schema Prisma (koordinasi dulu) |

Perubahan `packages/db/prisma/schema.prisma` = **wajib bilang di grup** (dua app bergantung padanya). Setelah ubah: `pnpm db:push && pnpm --filter @kopra/db generate`.

## Git

- Branch: langsung `main` saja (sprint 36 jam, bukan production). Commit kecil & sering, pesan jelas: `feat(api): webhook waha`, `fix(agent): resume YA case-insensitive`.
- `git pull --rebase` sebelum push. Konflik schema → koordinasi, jangan force.
- **Tidak pernah commit**: `.env`, `db_dump/`, kredensial apa pun. Repo publik saat submission.

## Coding agents (Claude Code / Codex)

- Buka sesi agent dari **root monorepo** supaya konteks workspace kebaca.
- Suruh agent baca `docs/00-core-features.md` dulu di awal sesi — scope terkunci ada di situ, termasuk CUT-LIST (jangan biarkan agent membangun fitur yang sudah dicoret).
- Jalankan `npx skills add mastra-ai/skills` sekali (sudah masuk repo `.claude/`/`.agents/` kalau ada) — supaya agent menulis API Mastra yang benar.
- Prinsip yang harus dijaga di semua kode agent: **LLM explains, backend calculates** — angka selalu dari SQL/Prisma, commit transaksi hanya lewat workflow step setelah "YA".

## Struktur folder target

```
apps/web/          Next.js App Router
  app/(dashboard)/ dashboard, coa, jurnal, produk-stok, anggota-simpanan, laporan
  app/(public)/    landing
  app/chat/        chat asisten (useChat → agent)
apps/api/          NestJS
  src/auth/        JWT login
  src/koperasi/    CRUD anggota+simpanan, unit, produk+stok
  src/accounting/  COA + jurnal (posting rules)
  src/reports/     buku besar, neraca saldo, PHU, neraca, view buku kas
  src/whatsapp/    interface WhatsappGateway + adapter GoWA (webhook HMAC, kirim pesan, media download); WAHA = adapter fallback
apps/agent/        Mastra
  src/mastra/agents/kopra.ts
  src/mastra/tools/        createEntryDraft, recordStockMovement, getStockLevels,
                           getFinancialSummary, listUnpaidMembers, generateReport,
                           searchKoperasiGuides
  src/mastra/workflows/recordEntry.ts   (suspend → "YA" → resume atomik)
  src/rag/         ingest script + corpus loader
packages/db/       Prisma (schema final — lihat README-nya)
```

## Ports

| Service | Port |
|---|---|
| web | 3000 |
| api | 3001 |
| GoWA (repo infra) | 3002 |
| agent (Mastra) | 4111 |
| postgres app (docker) | 5433 |
| postgres lokal dev (mirror data panitia) | 5432 |

## Scope guard

Kalau ragu sebuah fitur perlu dibangun: cek `docs/00-core-features.md` §CUT-LIST dan §Backlog. Kalau tetap ragu → tanya di grup, default = JANGAN bangun. Urutan potong scope kalau kepepet ada di §8.
