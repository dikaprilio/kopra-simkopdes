import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { prisma } from "@kopra/db";
import {
  createDraftFromSimple,
  createMovementDraft,
  paySavingDraft,
  createPending,
  findProduct,
  reverseEntry,
  writeAudit,
} from "@kopra/core";
import { getActor, rp } from "../../lib/context";
import { gate, domainErrorText } from "./gate";

/**
 * Tools TULIS — semuanya hanya membuat DRAFT + PendingAction.
 * Commit terjadi di orchestrator api saat user balas "YA" (bukan di agent).
 * Setiap tool MENGEMBALIKAN previewText yang harus ditampilkan bot apa adanya.
 */

const FOOTER = '👉 Balas *YA* untuk simpan, *BATAL* untuk batalkan, atau koreksi langsung (contoh: "eh 450rb" / "lewat bank").';

const tanggal = () =>
  new Date().toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });

async function audit(actor: ReturnType<typeof getActor>, action: string, ref: string, preview: string) {
  await writeAudit({
    koperasiId: actor.koperasiId,
    actorId: actor.actorId,
    channel: actor.channel,
    action,
    resourceType: "PendingAction",
    resourceRef: ref,
    result: "OK",
    payload: { preview },
  });
}

export const createEntryDraft = createTool({
  id: "createEntryDraft",
  description:
    "Buat DRAFT jurnal pemasukan/pengeluaran dari kalimat pengurus (mis. 'catat pemasukan banyu 500rb'). amount dalam rupiah penuh (500rb → 500000). unitName = nama unit usaha bila disebut.",
  inputSchema: z.object({
    kind: z.enum(["INCOME", "EXPENSE"]),
    amount: z.number().positive(),
    description: z.string(),
    via: z.enum(["KAS", "BANK"]).default("KAS"),
    unitName: z.string().optional(),
  }),
  execute: async (input, ctx) => {
    const actor = getActor(ctx?.requestContext);
    const deny = gate(actor, "WRITE_ERP");
    if (deny) return { denied: deny };
    try {
      let businessUnitId: string | undefined;
      let unitLabel = "";
      if (input.unitName) {
        const unit = await prisma.businessUnit.findFirst({
          where: { koperasiId: actor.koperasiId!, nama: { contains: input.unitName, mode: "insensitive" } },
        });
        if (unit) {
          businessUnitId = unit.id;
          unitLabel = ` • ${unit.nama}`;
        }
      }
      const draft = await createDraftFromSimple(actor.actorId!, {
        koperasiId: actor.koperasiId!,
        kind: input.kind,
        amount: input.amount,
        description: input.description,
        via: input.via,
        businessUnitId,
      });
      const jenis = input.kind === "INCOME" ? "Pemasukan" : "Pengeluaran";
      const viaLabel = input.via === "BANK" ? "Bank" : "Kas";
      const previewText =
        `📝 *Draft Jurnal — mohon periksa:*\n` +
        `${jenis}${unitLabel} • *${rp(input.amount)}*\n` +
        `"${input.description}" • ${viaLabel} • ${tanggal()}\n${FOOTER}`;
      const pending = await createPending({
        chatJid: actor.chatJid ?? actor.actorId!,
        actorId: actor.actorId!,
        koperasiId: actor.koperasiId!,
        actionType: "JOURNAL_SIMPLE",
        payload: { previewText, entryId: draft.entry.id, via: input.via },
      });
      await audit(actor, "createEntryDraft", pending.id, previewText);
      return { previewText };
    } catch (e) {
      return { error: domainErrorText(e) };
    }
  },
});

export const recordStockMovementDraft = createTool({
  id: "recordStockMovementDraft",
  description:
    "Buat DRAFT pergerakan stok: 'kejual X 5' → type OUT; 'beli/kulakan X' → type IN (sertakan hargaBeli total per unit bila disebut); penyesuaian → ADJUST. Utk OUT harga jual otomatis dari master produk bila tak disebut.",
  inputSchema: z.object({
    productName: z.string(),
    type: z.enum(["IN", "OUT", "ADJUST"]),
    qty: z.number().positive(),
    hargaBeli: z.number().positive().optional().describe("harga beli PER UNIT"),
    hargaJual: z.number().positive().optional().describe("harga jual PER UNIT"),
  }),
  execute: async (input, ctx) => {
    const actor = getActor(ctx?.requestContext);
    const deny = gate(actor, "WRITE_ERP");
    if (deny) return { denied: deny };
    try {
      const res = await createMovementDraft(actor.actorId!, {
        koperasiId: actor.koperasiId!,
        productQuery: input.productName,
        type: input.type,
        qty: input.qty,
        hargaBeli: input.hargaBeli,
        hargaJual: input.hargaJual,
      });
      const p = res.product;
      let previewText: string;
      if (res.journal && input.type === "OUT") {
        const harga = res.journal.amount / input.qty;
        previewText =
          `📝 *Draft Penjualan:*\n` +
          `${p.nama} × ${input.qty} ${p.unit ?? ""} @${rp(harga)} = *${rp(res.journal.amount)}* (masuk Kas)\n` +
          `Stok: ${res.stokSebelum} → *${res.stokSesudah} ${p.unit ?? ""}*\n` +
          `(1 chat = 2 catatan: stok keluar + jurnal pemasukan)\n${FOOTER}`;
      } else if (res.journal && input.type === "IN") {
        previewText =
          `📝 *Draft Belanja Stok:*\n` +
          `${p.nama} × ${input.qty} ${p.unit ?? ""} = *${rp(res.journal.amount)}* (keluar Kas)\n` +
          `Stok: ${res.stokSebelum} → *${res.stokSesudah} ${p.unit ?? ""}*\n${FOOTER}`;
      } else {
        previewText =
          `📝 *Draft Penyesuaian Stok:*\n` +
          `${p.nama}: ${res.stokSebelum} → *${res.stokSesudah} ${p.unit ?? ""}* (${input.type} ${input.qty})\n${FOOTER}`;
      }
      const pending = await createPending({
        chatJid: actor.chatJid ?? actor.actorId!,
        actorId: actor.actorId!,
        koperasiId: actor.koperasiId!,
        actionType: "STOCK_MOVE",
        payload: res.journal
          ? { previewText, entryId: res.journal.entry.id }
          : { previewText, movementId: res.movementId },
      });
      await audit(actor, "recordStockMovementDraft", pending.id, previewText);
      return { previewText };
    } catch (e) {
      const msg = domainErrorText(e);
      // produk tak dikenal → tawarkan pendaftaran produk (flow F7)
      if (msg.includes("belum terdaftar"))
        return {
          error: `Hmm, produk *"${input.productName}"* belum terdaftar. Mau saya daftarkan sebagai produk baru? Balas: "daftarkan, harga jual <harga>" atau BATAL.`,
        };
      return { error: msg };
    }
  },
});

export const paySavingDraftTool = createTool({
  id: "paySavingDraft",
  description:
    "Buat DRAFT pembayaran simpanan anggota, boleh rapel: 'catat bu painem bayar simpanan apr-jun 30rb' → periods ['2026-04','2026-05','2026-06'], totalAmount 30000.",
  inputSchema: z.object({
    memberName: z.string(),
    periods: z.array(z.string().regex(/^\d{4}-\d{2}$/)).min(1),
    totalAmount: z.number().positive(),
    savingType: z.enum(["POKOK", "WAJIB"]).default("WAJIB"),
    via: z.enum(["KAS", "BANK"]).default("KAS"),
  }),
  execute: async (input, ctx) => {
    const actor = getActor(ctx?.requestContext);
    const deny = gate(actor, "WRITE_ERP");
    if (deny) return { denied: deny };
    try {
      const res = await paySavingDraft(actor.actorId!, {
        koperasiId: actor.koperasiId!,
        memberQuery: input.memberName,
        periods: input.periods,
        amount: input.totalAmount,
        savingType: input.savingType,
        via: input.via,
      });
      const previewText =
        `📝 *Draft:* Pembayaran simpanan ${input.savingType.toLowerCase()} • ${res.member.nama} • ` +
        `${input.periods.length} periode (${input.periods.join(", ")}) • *${rp(input.totalAmount)}* • ${input.via === "BANK" ? "Bank" : "Kas"}\n${FOOTER}`;
      const pending = await createPending({
        chatJid: actor.chatJid ?? actor.actorId!,
        actorId: actor.actorId!,
        koperasiId: actor.koperasiId!,
        actionType: "SAVING_PAY",
        payload: {
          previewText,
          entryId: res.journal.entry.id,
          via: input.via,
          saving: {
            memberId: res.member.id,
            savingType: input.savingType,
            periods: input.periods,
            amountPerPeriod: Math.round(input.totalAmount / input.periods.length),
          },
        },
      });
      await audit(actor, "paySavingDraft", pending.id, previewText);
      return { previewText };
    } catch (e) {
      return { error: domainErrorText(e) };
    }
  },
});

export const createProductDraft = createTool({
  id: "createProductDraft",
  description: "Buat DRAFT pendaftaran produk baru ('daftarkan indomilk, harga jual 3500').",
  inputSchema: z.object({
    nama: z.string(),
    hargaJual: z.number().positive().optional(),
    unit: z.string().optional().describe("satuan, mis. Pcs/Liter/Kg"),
  }),
  execute: async (input, ctx) => {
    const actor = getActor(ctx?.requestContext);
    const deny = gate(actor, "WRITE_ERP");
    if (deny) return { denied: deny };
    try {
      const existing = await findProduct(actor.koperasiId!, input.nama);
      if (existing && existing.nama.toLowerCase() === input.nama.toLowerCase())
        return { error: `Produk *${existing.nama}* sudah terdaftar.` };
      const previewText =
        `📝 *Draft Produk Baru:*\n` +
        `${input.nama}${input.unit ? ` (${input.unit})` : ""}` +
        `${input.hargaJual ? ` • harga jual *${rp(input.hargaJual)}*` : ""}\n${FOOTER}`;
      const pending = await createPending({
        chatJid: actor.chatJid ?? actor.actorId!,
        actorId: actor.actorId!,
        koperasiId: actor.koperasiId!,
        actionType: "PRODUCT_CREATE",
        payload: {
          previewText,
          product: { nama: input.nama, hargaJual: input.hargaJual, unit: input.unit },
        },
      });
      await audit(actor, "createProductDraft", pending.id, previewText);
      return { previewText };
    } catch (e) {
      return { error: domainErrorText(e) };
    }
  },
});

export const updateProductDraft = createTool({
  id: "updateProductDraft",
  description:
    "Buat DRAFT ubah master produk: ganti harga jual ('ubah harga minyakita jadi 16rb'), ganti nama, atau satuan. Hanya field yang disebut user yang diisi.",
  inputSchema: z.object({
    productName: z.string().describe("nama produk yang mau diubah (boleh sebagian)"),
    hargaJual: z.number().positive().optional(),
    namaBaru: z.string().optional(),
    unit: z.string().optional(),
  }),
  execute: async (input, ctx) => {
    const actor = getActor(ctx?.requestContext);
    const deny = gate(actor, "WRITE_ERP");
    if (deny) return { denied: deny };
    try {
      const product = await findProduct(actor.koperasiId!, input.productName);
      if (!product) return { error: `Produk "${input.productName}" tidak ditemukan.` };
      const perubahan: string[] = [];
      if (input.namaBaru) perubahan.push(`nama → *${input.namaBaru}*`);
      if (input.unit) perubahan.push(`satuan → *${input.unit}*`);
      if (input.hargaJual)
        perubahan.push(
          `harga jual ${product.hargaJual ? rp(Number(product.hargaJual)) : "-"} → *${rp(input.hargaJual)}*`,
        );
      if (!perubahan.length) return { error: "Tidak ada perubahan yang disebut." };
      const previewText = `📝 *Draft Ubah Produk — ${product.nama}:*\n${perubahan.map((x) => `• ${x}`).join("\n")}\n👉 Balas *YA* untuk simpan, *BATAL* untuk batalkan.`;
      const pending = await createPending({
        chatJid: actor.chatJid!,
        actorId: actor.actorId!,
        koperasiId: actor.koperasiId!,
        actionType: "PRODUCT_UPDATE",
        payload: {
          previewText,
          productUpdate: {
            productId: product.id,
            patch: { nama: input.namaBaru, unit: input.unit, hargaJual: input.hargaJual },
          },
        },
      });
      await audit(actor, "product.update.draft", pending.id, previewText);
      return { previewText };
    } catch (e) {
      return { error: domainErrorText(e) };
    }
  },
});

export const deleteProductDraft = createTool({
  id: "deleteProductDraft",
  description:
    "Buat DRAFT hapus produk ('hapus produk air galon'). Produk yang punya riwayat stok TIDAK dihapus permanen melainkan dinonaktifkan (riwayat pembukuan tetap utuh) — sampaikan ini ke user.",
  inputSchema: z.object({ productName: z.string() }),
  execute: async (input, ctx) => {
    const actor = getActor(ctx?.requestContext);
    const deny = gate(actor, "WRITE_ERP");
    if (deny) return { denied: deny };
    try {
      const product = await findProduct(actor.koperasiId!, input.productName);
      if (!product) return { error: `Produk "${input.productName}" tidak ditemukan.` };
      const riwayat = await prisma.stockMovement.count({ where: { productId: product.id } });
      const mode =
        riwayat > 0
          ? `*dinonaktifkan* (punya ${riwayat} riwayat stok — pembukuan lama tetap utuh)`
          : "*dihapus permanen* (belum punya riwayat)";
      const previewText = `🗑️ *Draft Hapus Produk:*\n*${product.nama}* akan ${mode}.\n👉 Balas *YA* untuk lanjut, *BATAL* untuk batalkan.`;
      const pending = await createPending({
        chatJid: actor.chatJid!,
        actorId: actor.actorId!,
        koperasiId: actor.koperasiId!,
        actionType: "PRODUCT_DELETE",
        payload: { previewText, productDelete: { productId: product.id } },
      });
      await audit(actor, "product.delete.draft", pending.id, previewText);
      return { previewText };
    } catch (e) {
      return { error: domainErrorText(e) };
    }
  },
});

export const createMemberDraft = createTool({
  id: "createMemberDraft",
  description:
    "Buat DRAFT anggota koperasi baru ('daftarkan anggota baru bu Sari, nomor 0812…'). JANGAN pernah minta/isi NIK — NIK hanya lewat form web.",
  inputSchema: z.object({
    nama: z.string(),
    waNumber: z.string().optional().describe("nomor WA/HP bila disebut, digit saja"),
  }),
  execute: async (input, ctx) => {
    const actor = getActor(ctx?.requestContext);
    const deny = gate(actor, "WRITE_ERP");
    if (deny) return { denied: deny };
    try {
      const previewText = `📝 *Draft Anggota Baru:*\nNama: *${input.nama}*${input.waNumber ? `\nWA: ${input.waNumber}` : ""}\n(NIK bisa dilengkapi nanti lewat web)\n👉 Balas *YA* untuk simpan, *BATAL* untuk batalkan.`;
      const pending = await createPending({
        chatJid: actor.chatJid!,
        actorId: actor.actorId!,
        koperasiId: actor.koperasiId!,
        actionType: "MEMBER_CREATE",
        payload: { previewText, member: { nama: input.nama, waNumber: input.waNumber } },
      });
      await audit(actor, "member.create.draft", pending.id, previewText);
      return { previewText };
    } catch (e) {
      return { error: domainErrorText(e) };
    }
  },
});

export const reverseJournalDraft = createTool({
  id: "reverseJournalDraft",
  description:
    "Buat DRAFT jurnal PEMBALIK untuk membatalkan jurnal yang SUDAH tersimpan ('batalkan jurnal JU-025'). Jurnal asli tidak dihapus (aturan pembukuan) — dibuat jurnal lawan yang menetralkannya. Draft yang belum tersimpan cukup dibatalkan dengan BATAL biasa.",
  inputSchema: z.object({ nomorJurnal: z.string().describe("mis. JU-025") }),
  execute: async (input, ctx) => {
    const actor = getActor(ctx?.requestContext);
    const deny = gate(actor, "WRITE_ERP");
    if (deny) return { denied: deny };
    try {
      const res = await reverseEntry(actor.actorId!, input.nomorJurnal, actor.koperasiId!);
      const previewText = `↩️ *Draft Jurnal Pembalik:*\nMembatalkan *${res.asal.nomor}* — "${res.asal.keterangan}" senilai *${rp(res.total)}*.\nJurnal baru *${res.draft.nomor}* akan menetralkan nilainya (jurnal asli tetap tercatat).\n👉 Balas *YA* untuk simpan, *BATAL* untuk batalkan.`;
      const pending = await createPending({
        chatJid: actor.chatJid!,
        actorId: actor.actorId!,
        koperasiId: actor.koperasiId!,
        actionType: "JOURNAL_MANUAL",
        payload: { previewText, entryId: res.draft.id },
      });
      await audit(actor, "journal.reverse.draft", pending.id, previewText);
      return { previewText };
    } catch (e) {
      return { error: domainErrorText(e) };
    }
  },
});
