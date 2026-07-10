# apps/web — Next.js (frontend)

SUDAH di-scaffold (Fase 0.1). Perintah asal (referensi):

```bash
# dari root monorepo
pnpm create next-app@latest apps/web --ts --app --tailwind --eslint --src-dir=false --import-alias "@/*" --use-pnpm
```

Lalu set `"name": "web"` di `apps/web/package.json`.

Halaman (lihat docs/CONVENTIONS.md untuk struktur):
- `(dashboard)`: dashboard cards, transaksi (ledger), unit-usaha, anggota, laporan (print-friendly)
- `(public)`: landing, learning-path (statis — artefak Pilar 4)
- `chat`: asisten (AI SDK `useChat` → endpoint streaming apps/agent, bawa JWT)

Data CRUD via `apps/api` (REST, JWT). JANGAN akses Prisma langsung dari web.
