# Kopra — Asisten Digital Koperasi Merah Putih

> **Hackathon Digital Cooperatives Expo 2026** — Kemenkop RI × PEBS FEB UI · Tim Fandelion · Pilar 1 (Peningkatan Volume Usaha Koperasi)

**Masalah:** 92% Kopdes Merah Putih punya akun SIMKOPDES, tapi <1% yang aktif memakainya untuk bisnis. Pengurus tetap bekerja di WhatsApp dan Excel.

**Solusi:** Kopra bertemu pengurus di tempat mereka berada — **WhatsApp** — dan mengubah kebiasaan chat menjadi pembukuan terstruktur: catat transaksi via chat/foto nota/voice note → konfirmasi "YA" → masuk ledger → laporan otomatis. Plus catat stok & simpanan via chat, dan asisten RAG untuk panduan koperasi — semuanya menghasilkan jurnal ber-standar CORE resmi. Hasilnya: volume usaha koperasi tercatat, terukur, dan siap untuk kemitraan & pembiayaan.

## Arsitektur

```
apps/web     Next.js      — dashboard ERP, chat asisten, landing
apps/api     NestJS       — auth/JWT, CRUD, laporan, webhook WAHA, audit log
apps/agent   Mastra       — agent "kopra", workflow konfirmasi (suspend/resume),
                            memory per nomor WA, RAG (pgvector)
packages/db  Prisma       — schema & client (dipakai api + agent)
```

```
WhatsApp user → WAHA (repo kopra-whatsapp-waha) → api /wa/webhook
             → agent (Mastra API) → api → WAHA → user
Browser      → web → api (CRUD) & agent (chat streaming, JWT)
```

Prinsip non-negotiable: **LLM explains, backend calculates.** Semua angka dari SQL; commit transaksi = kode deterministik setelah user balas "YA".

## Quickstart (Aldio mulai di sini)

```bash
# prasyarat: Node 20+, pnpm 9+, Docker Desktop
corepack enable && pnpm install

cp .env.example .env          # isi ANTHROPIC_API_KEY dkk (minta di grup tim)

docker compose up -d postgres # DB app (port 5433, biar tak tabrakan dgn Postgres lokalmu)
pnpm db:push && pnpm db:seed  # schema + seed data demo

pnpm dev:api                  # NestJS  → http://localhost:3001
pnpm dev:agent                # Mastra  → http://localhost:4111 (+ playground!)
pnpm dev:web                  # Next.js → http://localhost:3000
```

WAHA (WhatsApp) jalan dari repo terpisah: [`kopra-whatsapp-waha`](https://github.com/dikaprilio/kopra-whatsapp-waha).

## Dokumentasi (BACA SEBELUM CODING)

| Doc | Isi |
|---|---|
| [docs/CONTEXT.md](docs/CONTEXT.md) | **Full context summary** — sejarah keputusan, seluruh riset, infra, keadaan repo, gotchas (mulai dari sini untuk sesi agent baru) |
| [docs/00-core-features.md](docs/00-core-features.md) | **Spec utama** — scope terkunci, fase, cut-list, demo script |
| [docs/01-shared-db.md](docs/01-shared-db.md) | Database resmi panitia: skema, insight, strategi import |
| [docs/02-riset-adoption-gap.md](docs/02-riset-adoption-gap.md) | Data & sumber untuk pitch (92% vs <1%, dst.) |
| [docs/03-brainstorming-handoff.md](docs/03-brainstorming-handoff.md) | Riset lapangan: interview Bu Anita & Pak Tedjo |
| [docs/CONVENTIONS.md](docs/CONVENTIONS.md) | Konvensi kode, pembagian kerja, cara pakai coding agents |

## Pembagian kerja

| Siapa | Area | Folder |
|---|---|---|
| Dev 1 | ERP: CRUD, dashboard, laporan | `apps/api` + `apps/web` |
| Dev 2 | Agent: tools, workflow YA, RAG, WA flow | `apps/agent` + `apps/api/src/whatsapp` |
| Hustler | Pitch deck, video demo, seed konten RAG | `docs/`, korpus RAG |

## ⚠️ Jangan pernah commit

`.env`, kredensial shared DB panitia, dump database (`db_dump/`), API keys. Repo ini akan **publik** saat submission.

## Disclosure AI (wajib TOR)

Pengembangan dibantu Claude Code & Codex untuk coding assistance, debugging, dan scaffolding. Ide produk, riset lapangan (interview KDMP Bangunharjo & Palbapang), dan keputusan desain adalah orisinal Tim Fandelion.
