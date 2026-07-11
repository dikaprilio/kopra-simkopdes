/**
 * Integration tests — DB kopra_test (di-push oleh global-setup).
 * Menguji jalur uang inti: draft→YA atomik, duplicate-YA idempotent,
 * satu-pending-per-chat, stok linked journal, simpanan PAID.
 */
import { beforeAll, describe, expect, it } from "vitest";
import { Client } from "pg";
import { prisma } from "@kopra/db";
import { DEFAULT_COA } from "../../db/src/coa-default";
import {
  createDraftFromSimple, createManualDraft, confirmEntry, rejectEntry, accountBalance, DomainError,
  revenueKodeForUnit,
} from "./journal.js";
import { confirmMovementOnly, createMovementDraft, currentStock } from "./stock.js";
import { findMember, paySavingDraft } from "./savings.js";
import { createPending, confirmPending, cancelPending, getAwaiting } from "./pending-action.js";

let kopId = "", userId = "", unitId = "", productId = "", memberId = "";
const CHAT = "628999@s.whatsapp.net";

async function runWhileConfirmationsAreBlockedOnProduct<T>(
  productId: string,
  run: () => Promise<T>,
): Promise<T> {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  let committed = false;
  let pending: Promise<T> | undefined;
  try {
    await client.query("BEGIN");
    await client.query('SELECT id FROM products WHERE id = $1 FOR UPDATE', [productId]);
    pending = run();
    const deadline = Date.now() + 2_000;
    let waiters = 0;
    while (Date.now() < deadline) {
      const result = await client.query<{ count: number }>(`
        SELECT COUNT(*)::int AS count
        FROM pg_stat_activity
        WHERE datname = current_database()
          AND pid <> pg_backend_pid()
          AND state = 'active'
          AND wait_event_type = 'Lock'
          AND query LIKE '%FROM products%FOR UPDATE%'`);
      waiters = result.rows[0]?.count ?? 0;
      if (waiters >= 1) break;
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    // Minimal proof that production reached SELECT ... FOR UPDATE. Depending on
    // Prisma pool availability, the second started transaction may queue in the
    // client until the first receives a connection; a no-lock implementation
    // produces zero database lock waiters and fails this assertion.
    expect(waiters).toBeGreaterThanOrEqual(1);
    await client.query("COMMIT");
    committed = true;
    return await pending;
  } finally {
    if (!committed) await client.query("ROLLBACK").catch(() => undefined);
    if (!committed && pending) await pending.catch(() => undefined);
    await client.end();
  }
}

beforeAll(async () => {
  // bersihkan urutan FK
  for (const t of [
    "pending_actions", "member_savings", "stock_movements", "journal_lines",
    "journal_entries", "products", "members", "business_units", "coa_accounts",
    "whatsapp_identities", "users", "koperasi",
  ]) await prisma.$executeRawUnsafe(`DELETE FROM ${t}`);

  const kop = await prisma.koperasi.create({
    data: { nama: "Kop Test", origin: "LOCAL", status: "ACTIVE", managementMode: "OWNER" },
  });
  kopId = kop.id;
  const idByKode = new Map<string, string>();
  for (const c of DEFAULT_COA) {
    const r = await prisma.coaAccount.create({
      data: { koperasiId: kopId, kode: c.kode, nama: c.nama, type: c.type,
        parentId: c.parentKode ? idByKode.get(c.parentKode) : undefined },
    });
    idByKode.set(c.kode, r.id);
  }
  const unit = await prisma.businessUnit.create({ data: { koperasiId: kopId, nama: "BANEW" } });
  unitId = unit.id;
  const unitRevenue = await prisma.coaAccount.create({
    data: { koperasiId: kopId, kode: "413000", nama: "Pendapatan BANEW", type: "REVENUE",
      parentId: idByKode.get("400000") },
  });
  await prisma.businessUnit.update({
    where: { id: unit.id },
    data: { revenueCoaId: unitRevenue.id },
  });
  const user = await prisma.user.create({
    data: { email: "t@t.id", passwordHash: "x", name: "Tester", role: "PENGURUS",
      status: "ACTIVE", koperasiId: kopId },
  });
  userId = user.id;
  const prod = await prisma.product.create({
    data: { koperasiId: kopId, nama: "MinyaKita 1L", unit: "Pcs", hargaJual: 15_500 },
  });
  productId = prod.id;
  await prisma.stockMovement.create({
    data: { koperasiId: kopId, productId, type: "ADJUST", qty: 30,
      sourceChannel: "SEED", status: "CONFIRMED", createdById: userId },
  });
  const member = await prisma.member.create({ data: { koperasiId: kopId, nama: "Bu Painem" } });
  memberId = member.id;
});

describe("journal draft → confirm", () => {
  it("draft INCOME per-unit: nomor JU-001, lines balanced, saldo kas belum berubah", async () => {
    const { entry, amount } = await createDraftFromSimple(userId, {
      koperasiId: kopId, kind: "INCOME", amount: 500_000,
      description: "penjualan air galon", businessUnitId: unitId,
    });
    expect(entry.nomor).toBe("JU-001");
    expect(amount).toBe(500_000);
    expect(entry.lines).toHaveLength(2);
    expect(await accountBalance(kopId, "111000")).toBe(0); // masih DRAFT

    await confirmEntry(entry.id, kopId);
    expect(await accountBalance(kopId, "111000")).toBe(500_000);
  });

  it("duplicate confirm → DomainError NOT_DRAFT (idempotent, saldo tak dobel)", async () => {
    const e = await prisma.journalEntry.findFirst({ where: { koperasiId: kopId, nomor: "JU-001" } });
    await expect(confirmEntry(e!.id, kopId)).rejects.toThrow(DomainError);
    expect(await accountBalance(kopId, "111000")).toBe(500_000);
  });

  it("CONFIRMED tidak bisa dihapus (immutable)", async () => {
    const e = await prisma.journalEntry.findFirst({ where: { koperasiId: kopId, nomor: "JU-001" } });
    await expect(rejectEntry(e!.id, kopId)).rejects.toThrow(/IMMUTABLE|balik/);
  });
});

describe("stok — jual = movement + jurnal linked, konfirmasi atomik via pending", () => {
  it("insufficient stock ditolak", async () => {
    await expect(
      createMovementDraft(userId, { koperasiId: kopId, productQuery: "minyakita", type: "OUT", qty: 999 }),
    ).rejects.toThrow(/INSUFFICIENT|tinggal/);
  });

  it("kejual 5 → draft OUT + jurnal Dr Kas 77.500; YA → dua-duanya CONFIRMED", async () => {
    const draft = await createMovementDraft(userId, {
      koperasiId: kopId, productQuery: "minyakita", type: "OUT", qty: 5,
    });
    expect(draft.journal).toBeTruthy();
    expect(draft.stokSesudah).toBe(25);
    expect(await currentStock(productId)).toBe(30); // draft belum dihitung

    await createPending({
      chatJid: CHAT, actorId: userId, koperasiId: kopId, actionType: "STOCK_MOVE",
      payload: { previewText: "jual 5", entryId: draft.journal!.entry.id, movementId: draft.movementId },
    });
    const res = await confirmPending(CHAT, userId);
    expect(res.saldoKas).toBe(577_500); // 500rb + 77.5rb
    expect(await currentStock(productId)).toBe(25);

    // duplicate YA
    await expect(confirmPending(CHAT, userId)).rejects.toThrow(/NO_PENDING|menunggu/);
    expect(await currentStock(productId)).toBe(25);
  });
});

describe("pending action — guard & cancel", () => {
  it("satu pending per chat: create kedua ditolak saat masih menunggu", async () => {
    const d1 = await createDraftFromSimple(userId, {
      koperasiId: kopId, kind: "EXPENSE", amount: 10_000, description: "beban a",
    });
    await createPending({
      chatJid: CHAT, actorId: userId, koperasiId: kopId, actionType: "JOURNAL_SIMPLE",
      payload: { previewText: "a", entryId: d1.entry.id },
    });
    await expect(
      createPending({
        chatJid: CHAT, actorId: userId, koperasiId: kopId, actionType: "JOURNAL_SIMPLE",
        payload: { previewText: "b" },
      }),
    ).rejects.toThrow(/PENDING_EXISTS|menunggu/);

    await cancelPending(CHAT, userId);
    expect(await getAwaiting(CHAT)).toBeNull();
    // draft ikut terhapus
    expect(await prisma.journalEntry.findUnique({ where: { id: d1.entry.id } })).toBeNull();
  });
});

describe("simpanan — rapel PAID + jurnal", () => {
  it("bayar 3 periode → YA → periods PAID ber-journalEntryId, saldo kas naik", async () => {
    const draft = await paySavingDraft(userId, {
      koperasiId: kopId, memberQuery: "painem", periods: ["2026-04", "2026-05", "2026-06"], amount: 30_000,
    });
    await createPending({
      chatJid: CHAT, actorId: userId, koperasiId: kopId, actionType: "SAVING_PAY",
      payload: {
        previewText: "bayar", entryId: draft.journal.entry.id,
        saving: { memberId, savingType: "WAJIB", periods: draft.periods, amountPerPeriod: 10_000 },
      },
    });
    const before = await accountBalance(kopId, "111000");
    await confirmPending(CHAT, userId);
    expect(await accountBalance(kopId, "111000")).toBe(before + 30_000);
    const paid = await prisma.memberSaving.findMany({ where: { memberId, status: "PAID" } });
    expect(paid).toHaveLength(3);
    expect(paid.every((p) => p.journalEntryId === draft.journal.entry.id)).toBe(true);
  });
});

describe("journal — tenant fence", () => {
  it("manual draft menolak businessUnitId milik koperasi lain", async () => {
    const otherKop = await prisma.koperasi.create({
      data: { nama: "Kop Tenant Lain", origin: "LOCAL", status: "ACTIVE", managementMode: "OWNER" },
    });
    const otherUnit = await prisma.businessUnit.create({
      data: { koperasiId: otherKop.id, nama: "Unit Tenant Lain" },
    });

    await expect(
      createManualDraft(
        userId,
        kopId,
        { keterangan: "lintas tenant", businessUnitId: otherUnit.id },
        [
          { coaKode: "111000", debit: 10_000, kredit: 0 },
          { coaKode: "410000", debit: 0, kredit: 10_000 },
        ],
      ),
    ).rejects.toMatchObject({ code: "UNIT_MISSING" });
  });

  it("simple draft tetap memvalidasi unit saat revenueCoaKode diberikan langsung", async () => {
    const otherKop = await prisma.koperasi.create({
      data: { nama: "Kop Tenant Override", origin: "LOCAL", status: "ACTIVE", managementMode: "OWNER" },
    });
    const otherUnit = await prisma.businessUnit.create({
      data: { koperasiId: otherKop.id, nama: "Unit Tenant Override" },
    });

    await expect(
      createDraftFromSimple(userId, {
        koperasiId: kopId,
        kind: "INCOME",
        amount: 10_000,
        description: "lintas tenant dengan kode eksplisit",
        businessUnitId: otherUnit.id,
        revenueCoaKode: "410000",
      }),
    ).rejects.toMatchObject({ code: "UNIT_MISSING" });
  });
});

describe("lifecycle selectors and linked revenue", () => {
  it("resolves a unit revenue code through its explicit link, not mutable names", async () => {
    const account = await prisma.coaAccount.create({
      data: {
        koperasiId: kopId,
        kode: "417000",
        nama: "Label pendapatan lama",
        type: "REVENUE",
      },
    });
    const unit = await prisma.businessUnit.create({
      data: {
        koperasiId: kopId,
        nama: "UNIT SUDAH BERGANTI NAMA",
        revenueCoaId: account.id,
      },
    });
    try {
      expect(await revenueKodeForUnit(kopId, unit.id)).toBe("417000");
    } finally {
      await prisma.businessUnit.delete({ where: { id: unit.id } });
      await prisma.coaAccount.delete({ where: { id: account.id } });
    }
  });

  it("rejects an archived unit for a new journal even with an explicit revenue code", async () => {
    const account = await prisma.coaAccount.create({
      data: { koperasiId: kopId, kode: "418000", nama: "Pendapatan UNIT ARSIP", type: "REVENUE" },
    });
    const unit = await prisma.businessUnit.create({
      data: {
        koperasiId: kopId,
        nama: "UNIT ARSIP",
        isActive: false,
        revenueCoaId: account.id,
      },
    });
    const attempt = createDraftFromSimple(userId, {
      koperasiId: kopId,
      kind: "INCOME",
      amount: 10_000,
      description: "transaksi baru unit arsip",
      businessUnitId: unit.id,
      revenueCoaKode: "410000",
    });
    try {
      await expect(attempt).rejects.toMatchObject({ code: "UNIT_ARCHIVED" });
    } finally {
      await attempt.catch(() => undefined);
      await prisma.journalEntry.deleteMany({ where: { businessUnitId: unit.id } });
      await prisma.businessUnit.delete({ where: { id: unit.id } });
      await prisma.coaAccount.delete({ where: { id: account.id } });
    }
  });

  it("member name selector ignores archived members", async () => {
    const [active, archived] = await Promise.all([
      prisma.member.create({ data: { koperasiId: kopId, nama: "Selector Active" } }),
      prisma.member.create({ data: { koperasiId: kopId, nama: "Selector", isActive: false } }),
    ]);
    try {
      expect(await findMember(kopId, "Selector")).toMatchObject({ id: active.id });
    } finally {
      await prisma.member.deleteMany({ where: { id: { in: [active.id, archived.id] } } });
    }
  });
});

describe("stok — concurrent OUT confirmation", () => {
  it("movement-only mengizinkan tepat satu konfirmasi saat stok gabungan tidak cukup", async () => {
    const product = await prisma.product.create({
      data: { koperasiId: kopId, nama: "Produk Race Movement", unit: "Pcs" },
    });
    await prisma.stockMovement.create({
      data: {
        koperasiId: kopId,
        productId: product.id,
        type: "ADJUST",
        qty: 5,
        sourceChannel: "SEED",
        status: "CONFIRMED",
        createdById: userId,
      },
    });
    const first = await createMovementDraft(userId, {
      koperasiId: kopId, productId: product.id, type: "OUT", qty: 4,
    });
    const second = await createMovementDraft(userId, {
      koperasiId: kopId, productId: product.id, type: "OUT", qty: 4,
    });

    const results = await runWhileConfirmationsAreBlockedOnProduct(product.id, () =>
      Promise.allSettled([
        confirmMovementOnly(first.movementId, kopId),
        confirmMovementOnly(second.movementId, kopId),
      ]),
    );

    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(results.find((result) => result.status === "rejected")).toMatchObject({
      reason: { code: "INSUFFICIENT_STOCK" },
    });
    expect(await currentStock(product.id)).toBe(1);
    const winner = [first.movementId, second.movementId][
      results.findIndex((result) => result.status === "fulfilled")
    ];
    await expect(confirmMovementOnly(winner, kopId)).rejects.toMatchObject({ code: "NOT_DRAFT" });
  });

  it("journal-linked mengizinkan tepat satu konfirmasi saat stok gabungan tidak cukup", async () => {
    const product = await prisma.product.create({
      data: { koperasiId: kopId, nama: "Produk Race Journal", unit: "Pcs", hargaJual: 10_000 },
    });
    await prisma.stockMovement.create({
      data: {
        koperasiId: kopId,
        productId: product.id,
        type: "ADJUST",
        qty: 5,
        sourceChannel: "SEED",
        status: "CONFIRMED",
        createdById: userId,
      },
    });
    const first = await createMovementDraft(userId, {
      koperasiId: kopId, productId: product.id, type: "OUT", qty: 4,
    });
    const second = await createMovementDraft(userId, {
      koperasiId: kopId, productId: product.id, type: "OUT", qty: 4,
    });

    const results = await runWhileConfirmationsAreBlockedOnProduct(product.id, () =>
      Promise.allSettled([
        confirmEntry(first.journal!.entry.id, kopId),
        confirmEntry(second.journal!.entry.id, kopId),
      ]),
    );

    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(results.find((result) => result.status === "rejected")).toMatchObject({
      reason: { code: "INSUFFICIENT_STOCK" },
    });
    expect(await currentStock(product.id)).toBe(1);
    const pairs = await prisma.stockMovement.findMany({
      where: { id: { in: [first.movementId, second.movementId] } },
      include: { journalEntry: { select: { status: true } } },
    });
    expect(
      pairs.filter((pair) => pair.status === "CONFIRMED" && pair.journalEntry?.status === "CONFIRMED"),
    ).toHaveLength(1);
    expect(
      pairs.filter((pair) => pair.status === "DRAFT" && pair.journalEntry?.status === "DRAFT"),
    ).toHaveLength(1);
    const winningJournalId = [first.journal!.entry.id, second.journal!.entry.id][
      results.findIndex((result) => result.status === "fulfilled")
    ];
    await expect(confirmEntry(winningJournalId, kopId)).rejects.toMatchObject({ code: "NOT_DRAFT" });
  });
});
