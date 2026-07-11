# Known Issues — Kopra

Backlog of known defects & debt found during Fase 1–4 reviews and E2E bring-up. Ordered for "plan fix later." Each entry: severity, owner-fence, exact location, what's wrong, and the proposed fix.

**Owner-fence** (merge-conflict boundary): **aldio** = `apps/web`, `apps/api/src/{auth,koperasi,accounting,reports,common}`; **dika** = `packages/{core,db}`, `apps/agent`, `apps/api/src/{whatsapp,registration}`; **shared** = spans both / `app.module.ts`.

Severity: 🔴 Critical (data integrity / crash) · 🟠 Important (fix before submission) · 🟡 Minor (polish / post-hackathon).

---

## 🔴 Critical

### KI-01 — Stock confirm does not re-check sufficiency (concurrent OUT → negative stock)
- **Owner:** dika (core)
- **Where:** `packages/core/src/stock.ts` — `confirmMovementOnly` (:130) and the linked-journal confirm path (:141). Sufficiency is checked only at *draft* time (`createMovementDraft`, :67–70), never re-asserted at confirm.
- **Problem:** Two OUT movements for the same product can both pass the draft-time check, then both confirm, driving stock negative. Same race class as the (now-fixed) rapel double-pay.
- **Fix:** In the confirm path, re-compute `currentStock(productId)` inside the transaction and re-assert `qty <= stok` before flipping to CONFIRMED (compare-and-swap on `status:'DRAFT'` already exists; add the stock guard alongside it). Throw `INSUFFICIENT_STOCK` (already maps to 409).

### KI-02 — Cross-channel double-draft race (WA + web on same records)
- **Owner:** shared (aldio `koperasi/members.service`, dika `apps/api/src/whatsapp`)
- **Where:** rapel: `apps/api/src/koperasi/members.service.ts` `pay()` reads UNPAID periods; the WA pending-action flow reads the same rows independently. Also applies to stock (KI-01) across channels.
- **Problem:** If a WA-driven payment and a web `pay()` both read the same UNPAID periods before either confirms, both create+confirm separate journals for the same periods. `confirmEntry` CAS prevents double-*confirm* of one draft, but not two independent drafts.
- **Fix:** Introduce a claim step — mark selected `memberSaving` rows `PENDING`/locked (compare-and-swap) at draft creation so the second reader finds nothing UNPAID. Coordinate the column/semantics with dika since both channels write it.

---

## 🟠 Important

### KI-03 — Rapel payment is not truly atomic (3 unsynchronized calls)
- **Owner:** aldio + dika (needs core tx support)
- **Where:** `apps/api/src/koperasi/members.service.ts` `pay()` — `paySavingDraft` → `confirmEntry` → `markPeriodsPaid`.
- **Current mitigation (commit b9c2167):** `markPeriodsPaid` is retried 3× and, on persistent failure after the journal is already CONFIRMED, throws an explicit `RAPEL_TANDA_PERIODE_GAGAL` telling staff not to re-pay. Prevents silent double-pay but leaves a manual-reconcile window.
- **Fix (proper):** Thread a Prisma transaction client through `paySavingDraft`/`confirmEntry`/`markPeriodsPaid` (core change) so journal-confirm + period-mark commit atomically. Deferred: behavior-changing refactor in dika's core.

### KI-04 — `createManualDraft` writes `businessUnitId` without tenant ownership check (core)
- **Owner:** dika (core)
- **Where:** `packages/core/src/journal.ts` `createManualDraft` (:96), writes `header.businessUnitId` directly (:113) — does **not** reuse the `UNIT_MISSING` guard that the simple-entry path uses (:41–45).
- **Status:** The HTTP layer is already guarded (`journal.service.ts` `createManual`, commit b9c2167), so `POST /journals` is safe. This is latent for any *other* future core caller.
- **Fix:** Call the same `{ id, koperasiId }` unit lookup inside `createManualDraft`; throw `UNIT_MISSING` when it doesn't belong to the koperasi.

### KI-05 — `neraca(asOf)` off-by-one-day (excludes the asOf date itself)
- **Owner:** aldio
- **Where:** `packages/core/src/reports.ts` — `accountTotals` `to` bound (:31) and buku-kas (:96) use `je.date < to`. `neraca()` passes `asOf` straight through (:67).
- **Problem:** "Neraca per 2026-07-11" actually reports through 2026-07-10. Not reachable from the current web UI (no date picker), but wrong for direct API calls / any future date filter.
- **Fix:** Make the upper bound inclusive-of-day — either `< to + 1 day` or normalize `asOf` to end-of-day before the query.

### KI-06 — Print report link 401s ("Versi cetak")
- **Owner:** aldio
- **Where:** `apps/web/app/(dashboard)/laporan/[jenis]/page.tsx:28` — plain `<a href=".../reports/${jenis}?format=html" target="_blank">`. The bare navigation can't send the `Authorization: Bearer` header, so the API returns 401.
- **Fix (recommended):** Client-side `fetch` of the HTML with the bearer token, then `window.open(URL.createObjectURL(blob))`. No API change, no token in any URL. (Alt: short-lived signed query token — more moving parts, token appears in history.)
- **Demo workaround (current):** pre-generate the HTML via authenticated curl; don't click the link live.

### KI-07 — `conversation.spec.ts` mock typing error fails full `tsc --noEmit`
- **Owner:** dika
- **Where:** `apps/api/src/whatsapp/conversation.spec.ts:75` — `TS2322`: a `jest.fn()` mock typed `[]` assigned where `[string, ActorContext]` is required (agent-client `ask` signature).
- **Impact:** Invisible to jest and to `tsc -p tsconfig.build.json` (build config excludes specs); only a full workspace `tsc --noEmit` flags it. Cosmetic for CI-as-configured, but pollutes typecheck output.
- **Fix:** Type the mock as `jest.fn<Promise<string>, [string, ActorContext]>()` (or `jest.MockedFunction`) so its call signature matches.

---

## 🟡 Minor

### KI-08 — `.gitignore` `*.sql` is too broad
- **Owner:** shared
- **Where:** `.gitignore:16` — `*.sql`. Required SQL fixtures (`rag_fts.sql`) had to be force-added.
- **Fix:** Add an exception, e.g. `!packages/db/**/*.sql`, so committed SQL fixtures aren't silently dropped for teammates.

### KI-09 — Login timing side-channel (user enumeration)
- **Owner:** aldio
- **Where:** `apps/api/src/auth/auth.service.ts:12–14` — `findUnique` early-returns before `argon2.verify` when the email is unknown, so unknown-email responses are measurably faster than wrong-password. Response body/status are already identical.
- **Fix:** Verify against a constant dummy argon2 hash when the user isn't found so both paths do equal work.

### KI-10 — `JWT_SECRET` falls back to `'dev-secret'`
- **Owner:** aldio
- **Where:** `apps/api/src/auth/auth.module.ts:12` — `process.env.JWT_SECRET ?? 'dev-secret'`.
- **Fix:** Fail fast if `JWT_SECRET` is unset in non-dev, or at minimum a README/ops note. Fine for localhost demo; matters only if exposed off-box.

### KI-11 — `/journals/simple` accepts saving/stock kinds without `meta`
- **Owner:** aldio
- **Where:** `apps/api/src/accounting/dto/create-simple-entry.dto.ts:4` — `kind` allows `SAVING_PAYMENT`/`STOCK_PURCHASE`/`STOCK_SALE` but the DTO carries no `meta`, so `buildLines()` defaults `savingType` to `WAJIB` and books with no member/product linkage.
- **Impact:** Unreachable from the built web UI (no such form). Direct API misuse only.
- **Fix:** Restrict the DTO `kind` to `INCOME`/`EXPENSE`, or require `meta` for the other kinds.

### KI-12 — Error-envelope asymmetry
- **Owner:** aldio
- **Where:** filter-authored errors (`DomainErrorFilter`) emit `{statusCode, code, message}`; Nest-native exceptions emit `{statusCode, message, error}`. Frontend can't rely on one shape.
- **Fix:** A global exception filter that normalizes all errors to `{statusCode, code, message}`. Touches every error path → re-verify web + dika's WA flows after. Deferred.

### KI-13 — COA `parentId` check-then-create not transactional
- **Owner:** aldio
- **Where:** `apps/api/src/accounting/coa.service.ts` `create()` — the tenant-ownership check on `parentId` (added b9c2167) runs before the insert, outside a transaction; also doesn't require the parent to be `isActive`.
- **Fix:** Wrap check+insert in a transaction; optionally require active parent. Very low risk (no COA delete endpoint exists).

### KI-14 — `updateDraft` final `findFirst` passed to `serializeDecimals` without null guard
- **Owner:** aldio
- **Where:** `apps/api/src/accounting/journal.service.ts` `updateDraft` — the re-read is nullable-typed; runtime-impossible inside the tx (row was just CAS-updated), only widens the inferred return type. Cosmetic.
- **Fix:** Non-null assert or narrow after the CAS.

### KI-15 — Operational: E2E scripts + real super-admin number send live WhatsApp
- **Owner:** shared (operational, not code)
- **Where:** `scripts/e2e-registration.mjs` reads `SUPER_ADMIN_WA_NUMBER` from `.env`. With the real paired number set, the approval step sends an actual WA message to that phone.
- **Mitigation:** Temp-swap to a test number when running E2E, restore after. Consider a `SUPER_ADMIN_WA_NUMBER_TEST` override or a `--dry-run` outbox mode for scripts.

---

## Resolved (for traceability)

- **Outbox worker crash (P2025)** — `drain()` threw when an outbox row vanished mid-retry, killing the whole api process. Fixed in `30be55a` (`updateMany` + outer catch). *(dika fence, fixed by aldio — inform dika.)*
- **Agent first-boot on this machine** — missing `apps/agent/.env`; missing dep `@ai-sdk/google-vertex` in `apps/agent/package.json`. Fixed in `30be55a`.
- **`nextShortCode()` unique-collision** — used latest-createdAt instead of numeric max; fixed in `2e0cbbd`.
- **Print-report stored XSS** — unescaped COA/journal free-text in `reports/html.ts`; escaped in `b9c2167`.
- **Cross-tenant `parentId`/`businessUnitId` (HTTP layer)** — guarded in `376c23e` / `b9c2167`.
