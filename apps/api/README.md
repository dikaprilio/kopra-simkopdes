# apps/api — NestJS (backend)

Belum di-scaffold. Generate dengan:

```bash
# dari root monorepo
pnpm dlx @nestjs/cli new api --directory apps/api --package-manager pnpm --skip-git
```

Set `"name": "api"` di package.json, port dari `API_PORT` (3001).

Modules (lihat docs/CONVENTIONS.md):
- `auth/` — login email+password → JWT (juga dipakai web → agent)
- `koperasi/` — CRUD members, business-units, transactions (scoped `koperasiId`!)
- `reports/` — buku kas & laba rugi (query agregat, render HTML print-friendly / JSON)
- `whatsapp/` — webhook WAHA (`POST /wa/webhook`), client kirim pesan, media download.
  Flow: identify nomor via `whatsapp_identities` → suspended workflow? resume via
  Mastra API : call agent → balas via WAHA. Nomor tak dikenal → balasan onboarding.

Dependensi: `@kopra/db` (Prisma client). Semua tool-call & write → `audit_logs`.
