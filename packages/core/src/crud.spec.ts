/**
 * Integration tests CRUD lanjutan bot (DB kopra_test):
 * PRODUCT_UPDATE / PRODUCT_DELETE (delete-guard) / MEMBER_CREATE / jurnal pembalik.
 * Jalan SETELAH domain.spec (vitest singleFork serial) — bikin fixture sendiri.
 */
import { beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@kopra/db";
import { DEFAULT_COA } from "../../db/src/coa-default";
import { accountBalance, createDraftFromSimple, confirmEntry, reverseEntry, DomainError } from "./journal.js";
import { createMember, deleteProductGuarded, updateProduct } from "./catalog.js";
import { confirmPending, createPending } from "./pending-action.js";
import { KODE } from "./posting-rules.js";

let kopId = "", userId = "";
const CHAT = "628777crud@s.whatsapp.net";

async function pendingConfirm(actionType: Parameters<typeof createPending>[0]["actionType"], payload: object) {
  await createPending({
    chatJid: CHAT,
    actorId: userId,
    koperasiId: kopId,
    actionType,
    payload: { previewText: "t", ...payload } as never,
  });
  return confirmPending(CHAT, userId);
}

beforeAll(async () => {
  const kop = await prisma.koperasi.create({
    data: { nama: "Kop CRUD Test", origin: "LOCAL", status: "ACTIVE", managementMode: "OWNER" },
  });
  kopId = kop.id;
  const idByKode = new Map<string, string>();
  for (const c of DEFAULT_COA) {
    const r = await prisma.coaAccount.create({
      data: {
        koperasiId: kopId, kode: c.kode, nama: c.nama, type: c.type,
        parentId: c.parentKode ? idByKode.get(c.parentKode) : undefined,
      },
    });
    idByKode.set(c.kode, r.id);
  }
  const user = await prisma.user.create({
    data: { email: "crud@t.id", passwordHash: "x", name: "Crud", role: "PENGURUS",
      status: "ACTIVE", koperasiId: kopId },
  });
  userId = user.id;
});

describe("PRODUCT_UPDATE via pending", () => {
  it("YA → nama/harga berubah; produk koperasi lain tak tersentuh", async () => {
    const p = await prisma.product.create({
      data: { koperasiId: kopId, nama: "Sabun Batang", hargaJual: 4000 },
    });
    await pendingConfirm("PRODUCT_UPDATE", {
      productUpdate: { productId: p.id, patch: { hargaJual: 5000, nama: "Sabun Mandi" } },
    });
    const after = await prisma.product.findUnique({ where: { id: p.id } });
    expect(after?.nama).toBe("Sabun Mandi");
    expect(Number(after?.hargaJual)).toBe(5000);
  });

  it("productId koperasi lain → PRODUCT_NOT_FOUND (tenancy)", async () => {
    const lain = await prisma.koperasi.create({
      data: { nama: "Kop Lain CRUD", origin: "LOCAL", status: "ACTIVE", managementMode: "OWNER" },
    });
    const pLain = await prisma.product.create({
      data: { koperasiId: lain.id, nama: "Punya Orang" },
    });
    await expect(updateProduct(kopId, pLain.id, { hargaJual: 1 })).rejects.toMatchObject({
      code: "PRODUCT_NOT_FOUND",
    });
  });
});

describe("PRODUCT_DELETE delete-guard via pending", () => {
  it("tanpa riwayat movement → dihapus permanen", async () => {
    const p = await prisma.product.create({ data: { koperasiId: kopId, nama: "Produk Kosong" } });
    await pendingConfirm("PRODUCT_DELETE", { productDelete: { productId: p.id } });
    expect(await prisma.product.findUnique({ where: { id: p.id } })).toBeNull();
  });

  it("ber-riwayat movement → hanya dinonaktifkan (riwayat utuh)", async () => {
    const p = await prisma.product.create({ data: { koperasiId: kopId, nama: "Produk Riwayat" } });
    await prisma.stockMovement.create({
      data: { koperasiId: kopId, productId: p.id, type: "ADJUST", qty: 5,
        sourceChannel: "SEED", status: "CONFIRMED", createdById: userId },
    });
    const mode = await deleteProductGuarded(kopId, p.id);
    expect(mode).toBe("INACTIVATED");
    const after = await prisma.product.findUnique({ where: { id: p.id } });
    expect(after?.isActive).toBe(false);
    expect(await prisma.stockMovement.count({ where: { productId: p.id } })).toBe(1);
  });
});

describe("MEMBER_CREATE via pending", () => {
  it("YA → anggota tercipta; nama duplikat ditolak", async () => {
    await pendingConfirm("MEMBER_CREATE", { member: { nama: "Bu Sari CRUD", waNumber: "62812000" } });
    const m = await prisma.member.findFirst({ where: { koperasiId: kopId, nama: "Bu Sari CRUD" } });
    expect(m?.waNumber).toBe("62812000");
    await expect(createMember(kopId, { nama: "bu sari crud" })).rejects.toMatchObject({
      code: "MEMBER_EXISTS",
    });
  });
});

describe("Jurnal pembalik (reverseEntry)", () => {
  it("balanced terbalik, YA menetralkan saldo, pembalikan kedua ditolak", async () => {
    const saldoAwal = await accountBalance(kopId, KODE.KAS);
    const { entry } = await createDraftFromSimple(userId, {
      koperasiId: kopId, kind: "INCOME", amount: 100_000, description: "pemasukan salah catat",
    });
    await confirmEntry(entry.id, kopId);
    expect(await accountBalance(kopId, KODE.KAS)).toBe(saldoAwal + 100_000);

    const res = await reverseEntry(userId, entry.nomor, kopId);
    expect(res.total).toBe(100_000);
    expect(res.draft.status).toBe("DRAFT");
    // debit↔kredit tertukar & tetap balanced
    const d = res.draft.lines.reduce((s, l) => s + Number(l.debit), 0);
    const k = res.draft.lines.reduce((s, l) => s + Number(l.kredit), 0);
    expect(d).toBe(k);

    await pendingConfirm("JOURNAL_MANUAL", { entryId: res.draft.id });
    expect(await accountBalance(kopId, KODE.KAS)).toBe(saldoAwal); // netral kembali

    await expect(reverseEntry(userId, entry.nomor, kopId)).rejects.toMatchObject({
      code: "ALREADY_REVERSED",
    });
  });

  it("jurnal DRAFT tidak bisa dibalik (harus BATAL biasa)", async () => {
    const { entry } = await createDraftFromSimple(userId, {
      koperasiId: kopId, kind: "EXPENSE", amount: 5_000, description: "draft saja",
    });
    await expect(reverseEntry(userId, entry.nomor, kopId)).rejects.toMatchObject({
      code: "ENTRY_NOT_FOUND",
    });
  });
});
