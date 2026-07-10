/**
 * Integration tests — DB kopra_test (di-push oleh global-setup).
 * Menguji jalur uang inti: draft→YA atomik, duplicate-YA idempotent,
 * satu-pending-per-chat, stok linked journal, simpanan PAID.
 */
import { beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@kopra/db";
import { DEFAULT_COA } from "../../db/src/coa-default";
import {
  createDraftFromSimple, confirmEntry, rejectEntry, accountBalance, DomainError,
} from "./journal";
import { createMovementDraft, currentStock } from "./stock";
import { paySavingDraft } from "./savings";
import { createPending, confirmPending, cancelPending, getAwaiting } from "./pending-action";

let kopId = "", userId = "", unitId = "", productId = "", memberId = "";
const CHAT = "628999@s.whatsapp.net";

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
  await prisma.coaAccount.create({
    data: { koperasiId: kopId, kode: "413000", nama: "Pendapatan BANEW", type: "REVENUE",
      parentId: idByKode.get("400000") },
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
