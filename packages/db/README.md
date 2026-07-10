# @kopra/db

Prisma schema + client, dipakai `apps/api` dan `apps/agent`.

- `prisma/schema.prisma` — 15 model, keuangan ala CORE resmi (COA + Jurnal double-entry; laporan derived). Jangan tambah model tanpa update `docs/00-core-features.md` §2.
- `src/index.ts` — export singleton PrismaClient (buat saat implementasi).
- `src/seed.ts` — seed demo: 1 koperasi, 6 unit usaha (dimensi), COA default KDMP, ~2 bulan jurnal (kosakata asli Palbapang, via posting rules), simpanan per periode, 2 user demo (`pengurus@kopra.id` / `anggota@kopra.id`).
- `src/import-koperasi.ts` — tarik 1 koperasi nyata dari `SOURCE_DATABASE_URL` (mirror data panitia): profil, anggota, pengurus, status simpanan PAID/UNPAID + produk → tabel Kopra. Momen demo "onboarding dari data resmi satu perintah".

```bash
pnpm db:push      # sync schema ke postgres docker (5433)
pnpm db:seed      # isi data demo
pnpm --filter @kopra/db import:koperasi -- --ref KOP-539EF09CDAAD
```

Catatan pgvector: schema pakai `extensions = [vector]` — image docker `pgvector/pgvector:pg16` sudah menyediakannya. Dimensi embedding 1024 (voyage/embedding model — finalkan saat implementasi RAG).
