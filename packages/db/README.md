# @kopra/db

Prisma schema + client, dipakai `apps/api` dan `apps/agent`.

- `prisma/schema.prisma` — 12 tabel (spec §6). Sudah final, jangan tambah tabel tanpa update `docs/00-core-features.md`.
- `src/index.ts` — export singleton PrismaClient (buat saat implementasi).
- `src/seed.ts` — seed demo: 1 koperasi (ala KDMP Palbapang), 6 unit usaha, kategori standar, ~2 bulan transaksi, 2 user demo (`pengurus@kopra.id` / `anggota@kopra.id`).
- `src/import-koperasi.ts` — tarik 1 koperasi nyata dari `SOURCE_DATABASE_URL` (mirror data panitia): profil, anggota, pengurus, status simpanan PAID/UNPAID → tabel Kopra. Momen demo "onboarding dari data resmi satu perintah".

```bash
pnpm db:push      # sync schema ke postgres docker (5433)
pnpm db:seed      # isi data demo
pnpm --filter @kopra/db import:koperasi -- --ref KOP-539EF09CDAAD
```

Catatan pgvector: schema pakai `extensions = [vector]` — image docker `pgvector/pgvector:pg16` sudah menyediakannya. Dimensi embedding 1024 (voyage/embedding model — finalkan saat implementasi RAG).
