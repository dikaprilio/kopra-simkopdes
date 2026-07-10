import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { prisma } from "@kopra/db";
import { accountBalance, stockLevels, findProduct, memberSavings, unpaidMembers, KODE } from "@kopra/core";
import { getActor, rp } from "../../lib/context";
import { gate } from "./gate";

/** "LLM explains, backend calculates" — semua angka dari SQL, bukan dari model. */

const monthRange = (month?: string) => {
  // month "2026-06"; default bulan berjalan
  const [y, m] = (month ?? new Date().toISOString().slice(0, 7)).split("-").map(Number);
  return { from: new Date(Date.UTC(y, m - 1, 1)), to: new Date(Date.UTC(y, m, 1)), label: `${y}-${String(m).padStart(2, "0")}` };
};

export const getCooperativeProfile = createTool({
  id: "getCooperativeProfile",
  description: "Profil koperasi yang terhubung: nama, alamat, unit usaha, jumlah anggota.",
  inputSchema: z.object({}),
  execute: async (_input, ctx) => {
    const actor = getActor(ctx?.requestContext);
    const deny = gate(actor, "READ_INVENTORY");
    if (deny) return { denied: deny };
    const kop = await prisma.koperasi.findUnique({
      where: { id: actor.koperasiId! },
      include: { businessUnits: true, _count: { select: { members: true } } },
    });
    if (!kop) return { denied: "Koperasi tidak ditemukan." };
    return {
      nama: kop.nama,
      desa: kop.desa,
      jumlahAnggota: kop._count.members,
      unitUsaha: kop.businessUnits.map((u) => u.nama),
    };
  },
});

export const getFinancialDashboard = createTool({
  id: "getFinancialDashboard",
  description:
    "Ringkasan keuangan satu bulan: total pemasukan, pengeluaran, surplus, saldo kas & bank, pemasukan per unit usaha. month format 'YYYY-MM' (kosong = bulan ini).",
  inputSchema: z.object({ month: z.string().optional() }),
  execute: async (input, ctx) => {
    const actor = getActor(ctx?.requestContext);
    const deny = gate(actor, "READ_FINANCE");
    if (deny) return { denied: deny };
    const { from, to, label } = monthRange(input.month);
    const kid = actor.koperasiId!;
    const [agg, perUnit, saldoKas, saldoBank] = await Promise.all([
      prisma.$queryRaw<{ pemasukan: number; pengeluaran: number }[]>`
        SELECT
          COALESCE(SUM(jl.kredit) FILTER (WHERE c.kode LIKE '4%'), 0)::float AS pemasukan,
          COALESCE(SUM(jl.debit)  FILTER (WHERE c.kode LIKE '5%'), 0)::float AS pengeluaran
        FROM journal_lines jl
        JOIN journal_entries je ON je.id = jl."entryId" AND je.status = 'CONFIRMED'
        JOIN coa_accounts c ON c.id = jl."coaId"
        WHERE je."koperasiId" = ${kid} AND je.date >= ${from} AND je.date < ${to}`,
      prisma.$queryRaw<{ akun: string; total: number }[]>`
        SELECT c.nama AS akun, COALESCE(SUM(jl.kredit),0)::float AS total
        FROM journal_lines jl
        JOIN journal_entries je ON je.id = jl."entryId" AND je.status = 'CONFIRMED'
        JOIN coa_accounts c ON c.id = jl."coaId"
        WHERE je."koperasiId" = ${kid} AND c.kode LIKE '41%'
          AND je.date >= ${from} AND je.date < ${to}
        GROUP BY c.nama HAVING SUM(jl.kredit) > 0
        ORDER BY total DESC`,
      accountBalance(kid, KODE.KAS),
      accountBalance(kid, KODE.BANK),
    ]);
    const a = agg[0] ?? { pemasukan: 0, pengeluaran: 0 };
    return {
      bulan: label,
      pemasukan: rp(a.pemasukan),
      pengeluaran: rp(a.pengeluaran),
      surplus: rp(a.pemasukan - a.pengeluaran),
      saldoKas: rp(saldoKas),
      saldoBank: rp(saldoBank),
      pemasukanPerUnit: perUnit.map((u) => `${u.akun}: ${rp(u.total)}`),
    };
  },
});

export const listJournalEntries = createTool({
  id: "listJournalEntries",
  description: "Daftar jurnal terakhir (nomor, tanggal, deskripsi, nominal, status). month opsional 'YYYY-MM'.",
  inputSchema: z.object({ month: z.string().optional(), limit: z.number().max(20).default(10) }),
  execute: async (input, ctx) => {
    const actor = getActor(ctx?.requestContext);
    const deny = gate(actor, "READ_FINANCE");
    if (deny) return { denied: deny };
    const range = input.month ? monthRange(input.month) : null;
    const entries = await prisma.journalEntry.findMany({
      where: {
        koperasiId: actor.koperasiId!,
        ...(range ? { date: { gte: range.from, lt: range.to } } : {}),
      },
      include: { lines: { select: { debit: true } } },
      orderBy: { date: "desc" },
      take: input.limit,
    });
    return entries.map((e) => ({
      nomor: e.nomor,
      tanggal: e.date.toISOString().slice(0, 10),
      deskripsi: e.keterangan,
      nominal: rp(e.lines.reduce((s, l) => s + Number(l.debit), 0)),
      status: e.status,
    }));
  },
});

export const listProducts = createTool({
  id: "listProducts",
  description: "Daftar produk/barang koperasi beserta harga jual.",
  inputSchema: z.object({}),
  execute: async (_input, ctx) => {
    const actor = getActor(ctx?.requestContext);
    const deny = gate(actor, "READ_INVENTORY");
    if (deny) return { denied: deny };
    const products = await prisma.product.findMany({
      where: { koperasiId: actor.koperasiId!, isActive: true },
      orderBy: { nama: "asc" },
    });
    return products.map((p) => ({
      nama: p.nama,
      unit: p.unit,
      hargaJual: p.hargaJual ? rp(Number(p.hargaJual)) : null,
    }));
  },
});

export const getStockLevels = createTool({
  id: "getStockLevels",
  description: "Stok terkini semua produk + daftar yang hampir habis (≤5).",
  inputSchema: z.object({}),
  execute: async (_input, ctx) => {
    const actor = getActor(ctx?.requestContext);
    const deny = gate(actor, "READ_INVENTORY");
    if (deny) return { denied: deny };
    const { all, low } = await stockLevels(actor.koperasiId!);
    return {
      stok: all.map((r) => `${r.nama}: ${r.stok} ${r.unit ?? ""}`.trim()),
      hampirHabis: low.map((r) => `${r.nama} (${r.stok})`),
    };
  },
});

export const getStockCard = createTool({
  id: "getStockCard",
  description: "Kartu stok satu produk: stok terkini + riwayat pergerakan terakhir. productName = nama/sebagian nama produk.",
  inputSchema: z.object({ productName: z.string() }),
  execute: async (input, ctx) => {
    const actor = getActor(ctx?.requestContext);
    const deny = gate(actor, "READ_INVENTORY");
    if (deny) return { denied: deny };
    const product = await findProduct(actor.koperasiId!, input.productName);
    if (!product) return { notFound: `Produk "${input.productName}" belum terdaftar.` };
    const moves = await prisma.stockMovement.findMany({
      where: { productId: product.id, status: "CONFIRMED" },
      orderBy: { createdAt: "desc" },
      take: 10,
    });
    const stok = moves.length
      ? await prisma.$queryRaw<{ s: number }[]>`
          SELECT COALESCE(SUM(CASE type WHEN 'IN' THEN qty WHEN 'OUT' THEN -qty ELSE qty END),0)::float AS s
          FROM stock_movements WHERE "productId" = ${product.id} AND status = 'CONFIRMED'`
      : [{ s: 0 }];
    return {
      produk: product.nama,
      stok: `${stok[0].s} ${product.unit ?? ""}`.trim(),
      riwayat: moves.map((m) => ({
        tanggal: m.createdAt.toISOString().slice(0, 10),
        tipe: m.type,
        qty: m.qty,
      })),
    };
  },
});

export const getMySavings = createTool({
  id: "getMySavings",
  description: "Simpanan pokok & wajib milik penanya sendiri (status per periode).",
  inputSchema: z.object({}),
  execute: async (_input, ctx) => {
    const actor = getActor(ctx?.requestContext);
    const deny = gate(actor, "READ_SELF");
    if (deny) return { denied: deny };
    if (!actor.memberId)
      return { denied: "Akunmu belum tertaut ke data anggota — hubungi pengurus koperasimu." };
    const rows = await memberSavings(actor.memberId);
    return rows.map((s) => ({
      jenis: s.type,
      periode: s.period,
      nominal: rp(Number(s.amount)),
      status: s.status,
    }));
  },
});

export const listUnpaidMembers = createTool({
  id: "listUnpaidMembers",
  description: "Daftar anggota penunggak simpanan wajib (khusus pengurus).",
  inputSchema: z.object({}),
  execute: async (_input, ctx) => {
    const actor = getActor(ctx?.requestContext);
    // data pribadi antar-anggota — HANYA pengurus/owner, apa pun channel-nya bukan grup
    if (!["PENGURUS", "OWNER"].includes(actor.role) || actor.channel === "GROUP")
      return { denied: "🙏 Maaf, daftar penunggak hanya bisa dilihat pengurus lewat DM/web." };
    const deny = gate(actor, "READ_FINANCE");
    if (deny) return { denied: deny };
    const rows = await unpaidMembers(actor.koperasiId!);
    return rows.map((r) => ({
      nama: r.nama,
      jumlahBulan: r.tunggakan,
      total: rp(r.total),
      periode: r.periods.join(", "),
    }));
  },
});

export const generateFinancialReport = createTool({
  id: "generateFinancialReport",
  description:
    "Tautan laporan keuangan resmi (buku-besar | neraca-saldo | phu | neraca) utk rentang tanggal. Kembalikan URL ke user.",
  inputSchema: z.object({
    reportType: z.enum(["buku-besar", "neraca-saldo", "phu", "neraca"]),
    from: z.string().describe("YYYY-MM-DD"),
    to: z.string().describe("YYYY-MM-DD"),
  }),
  execute: async (input, ctx) => {
    const actor = getActor(ctx?.requestContext);
    const deny = gate(actor, "READ_FINANCE");
    if (deny) return { denied: deny };
    const base = process.env.APP_PUBLIC_WEB_URL ?? "http://localhost:3000";
    return {
      url: `${base}/laporan/${input.reportType}?from=${input.from}&to=${input.to}`,
      catatan: "Laporan dihitung server dari jurnal CONFIRMED (bukan perkiraan).",
    };
  },
});
