/**
 * Seed demo Kopra — idempotent (aman dijalankan berulang).
 * Isi: koperasi_directory (dari JSON) · koperasi demo IMPORTED "KDMP Palbapang (Demo)"
 * · COA default · 6 unit usaha (+akun pendapatan per unit) · user demo · 15 member
 * (+simpanan campuran PAID/UNPAID, sebagian ber-NIK utk demo NIK-match)
 * · ImportedIdentity sampel (nikMasked utk demo prefix-match) · 10 produk sembako riil
 * · ~2 bulan jurnal kosakata asli Palbapang (via posting Dr/Cr eksplisit)
 * · opening ADJUST stok · SQL FTS rag_documents.
 *
 * Jalankan: pnpm db:seed   (butuh `pnpm db:push` dulu)
 */
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import argon2 from "argon2";
import {
  prisma,
  CoaType,
  EntrySource,
  EntryStatus,
  SavingStatus,
  SavingType,
  StockMoveType,
  UserRole,
} from "./index";
import { DEFAULT_COA, unitRevenueKode } from "./coa-default";

const DEMO_REF = "KOP-DEMO-PALBAPANG";
const UNITS = ["BRILINK", "POSPAY", "BANEW", "GERAI KANTOR", "MITRA SPPG", "AGRO MANDIRI"];

const PRODUCTS: Array<{ nama: string; unit: string; hargaJual: number }> = [
  { nama: "MinyaKita 1L", unit: "Pcs", hargaJual: 15500 },
  { nama: "Beras SPHP 5kg", unit: "Pcs", hargaJual: 62000 },
  { nama: "Gula Pasir 1kg", unit: "Pcs", hargaJual: 17500 },
  { nama: "Telur Ayam", unit: "kg", hargaJual: 28000 },
  { nama: "Gas LPG 3kg", unit: "Pcs", hargaJual: 19000 },
  { nama: "Tepung Terigu 1kg", unit: "Pcs", hargaJual: 12000 },
  { nama: "Air Mineral Galon (Banew)", unit: "Galon", hargaJual: 6000 },
  { nama: "Materai 10000", unit: "Pcs", hargaJual: 11500 },
  { nama: "Kopi Sachet (renceng)", unit: "Renceng", hargaJual: 12500 },
  { nama: "Mie Instan (dus)", unit: "Dus", hargaJual: 115000 },
];

// [tanggal-offset-hari, keterangan, unit, kodeDebit, kodeKredit, nominal]
type J = [number, string, string | null, string, string, number];
const JOURNALS: J[] = [
  [-55, "Setoran modal awal kas", null, "111000", "300000", 5_000_000],
  [-54, "Setoran anggota (simpanan pokok kolektif)", null, "111000", "310000", 1_500_000],
  [-52, "Modal unit usaha Banew", "BANEW", "114000", "111000", 2_477_500],
  [-50, "Penjualan Banew lembar 1", "BANEW", "111000", "413000", 2_338_000],
  [-48, "Laba Brilink", "BRILINK", "111000", "411000", 1_223],
  [-45, "Fee pisang (bagi hasil Mitra SPPG)", "MITRA SPPG", "111000", "415000", 178_500],
  [-42, "Belanja Banew ke-2", "BANEW", "114000", "111000", 2_565_000],
  [-40, "Print warna dan fotocopy undangan", null, "510000", "111000", 15_200],
  [-38, "Pembelian snack temu mitra", null, "510000", "111000", 165_000],
  [-35, "Penjualan materai", "POSPAY", "111000", "412000", 72_000],
  [-33, "Terima simpanan wajib anggota (rapel)", null, "111000", "320000", 120_000],
  [-30, "admin bank", null, "520000", "112100", 6_000],
  [-28, "Bagi hasil pisang", "MITRA SPPG", "111000", "415000", 180_000],
  [-25, "Penjualan buku tabungan", "GERAI KANTOR", "111000", "414000", 170_000],
  [-22, "Biaya konsumsi rapat koordinasi", null, "510000", "111000", 72_000],
  [-20, "Laba Brilink", "BRILINK", "111000", "411000", 2_500],
  [-18, "Penjualan Banew", "BANEW", "111000", "413000", 1_850_000],
  [-15, "Biaya cetak rekening koran", null, "510000", "112100", 35_000],
  [-12, "Terima simpanan wajib an anggota jan-mar", null, "111000", "320000", 150_000],
  [-10, "Bagi hasil pisang", "MITRA SPPG", "111000", "415000", 174_750],
  [-8, "Simpanan sukarela anggota (Agro Mandiri)", "AGRO MANDIRI", "111000", "300000", 1_000_000],
  [-6, "Belanja media tanam", "AGRO MANDIRI", "510000", "111000", 390_000],
  [-4, "Penjualan sembako gerai", "GERAI KANTOR", "111000", "414000", 843_500],
  [-2, "Biaya rapat pengurus", null, "510000", "111000", 87_000],
];

const daysAgo = (n: number) => new Date(Date.now() + n * 86_400_000);

async function main() {
  // ---------- 0. FTS SQL (idempotent) ----------
  const ftsPath = join(__dirname, "..", "sql", "rag_fts.sql");
  for (const stmt of readFileSync(ftsPath, "utf-8").split(";").map(s => s.trim()).filter(Boolean)) {
    await prisma.$executeRawUnsafe(stmt);
  }
  console.log("FTS rag_documents OK");

  // ---------- 1. Koperasi directory ----------
  const dirPath = join(__dirname, "..", "seed-data", "koperasi-directory.json");
  if (existsSync(dirPath)) {
    const rows: Array<{ sourceRef: string; nama: string; wilayah: string | null }> =
      JSON.parse(readFileSync(dirPath, "utf-8"));
    // createMany + skipDuplicates = cepat & idempotent
    await prisma.koperasiDirectory.createMany({ data: rows, skipDuplicates: true });
    console.log(`koperasi_directory: ${rows.length} baris`);
  } else {
    console.warn("seed-data/koperasi-directory.json belum ada — jalankan gen:directory di mesin ber-mirror");
  }

  // ---------- 2. Koperasi demo ----------
  const kop = await prisma.koperasi.upsert({
    where: { sourceRef: DEMO_REF },
    update: {},
    create: {
      nama: "KDMP Palbapang (Demo)",
      desa: "Palbapang, Bantul, DIY",
      sourceRef: DEMO_REF,
      origin: "IMPORTED",
      status: "ACTIVE",
      managementMode: "SUPER_ADMIN",
    },
  });

  // ---------- 3. COA default + akun pendapatan per unit ----------
  const coaId = new Map<string, string>();
  for (const c of DEFAULT_COA) {
    const row = await prisma.coaAccount.upsert({
      where: { koperasiId_kode: { koperasiId: kop.id, kode: c.kode } },
      update: {},
      create: {
        koperasiId: kop.id,
        kode: c.kode,
        nama: c.nama,
        type: c.type as CoaType,
        parentId: c.parentKode ? coaId.get(c.parentKode) : undefined,
      },
    });
    coaId.set(c.kode, row.id);
  }
  const unitIds = new Map<string, string>();
  for (let i = 0; i < UNITS.length; i++) {
    const u = await prisma.businessUnit.upsert({
      where: { koperasiId_nama: { koperasiId: kop.id, nama: UNITS[i] } },
      update: {},
      create: { koperasiId: kop.id, nama: UNITS[i] },
    });
    unitIds.set(UNITS[i], u.id);
    const kode = unitRevenueKode(i); // 411000..416000
    const rev = await prisma.coaAccount.upsert({
      where: { koperasiId_kode: { koperasiId: kop.id, kode } },
      update: {},
      create: {
        koperasiId: kop.id,
        kode,
        nama: `Pendapatan ${UNITS[i]}`,
        type: "REVENUE",
        parentId: coaId.get("400000"),
      },
    });
    if (!rev.isActive) {
      throw new Error(
        `Akun pendapatan ${kode} nonaktif; seed tidak akan mengaktifkan atau menautkannya otomatis.`,
      );
    }
    coaId.set(kode, rev.id);
    await prisma.businessUnit.update({
      where: { id: u.id },
      data: { revenueCoaId: rev.id },
    });
  }
  console.log(`COA: ${coaId.size} akun · unit: ${UNITS.length}`);

  // ---------- 4. Users demo ----------
  const hash = await argon2.hash("kopra123", { type: argon2.argon2id });
  const pengurus = await prisma.user.upsert({
    where: { email: "pengurus@kopra.id" },
    update: { koperasiId: kop.id },
    create: {
      email: "pengurus@kopra.id",
      passwordHash: hash,
      name: "Tedjo Demo",
      nik: "3402000000000001",
      role: "PENGURUS",
      status: "ACTIVE",
      koperasiId: kop.id,
    },
  });
  await prisma.user.upsert({
    where: { email: "anggota@kopra.id" },
    update: { koperasiId: kop.id },
    create: {
      email: "anggota@kopra.id",
      passwordHash: hash,
      name: "Sari Demo",
      nik: "3402000000000002",
      role: "ANGGOTA",
      status: "ACTIVE",
      koperasiId: kop.id,
    },
  });

  // ---------- 5. Members + simpanan + ImportedIdentity sampel ----------
  const memberNames = [
    "Sari", "Sodikin", "Sugeng", "Sariyem", "Dian", "Supri", "Wagiyo", "Painem",
    "Tukiyem", "Harjo", "Ngadiman", "Sumarni", "Parjo", "Legiyem", "Bagas",
  ];
  const periods = ["2026-01", "2026-02", "2026-03", "2026-04", "2026-05", "2026-06"];
  for (let i = 0; i < memberNames.length; i++) {
    const sref = `${DEMO_REF}-M${String(i + 1).padStart(2, "0")}`;
    const nik = i < 5 ? `34020000000001${String(i + 10)}` : null; // 5 member ber-NIK penuh (demo match)
    const m = await prisma.member.upsert({
      where: { sourceRef: sref },
      update: {},
      create: { koperasiId: kop.id, nama: `Bu/Pak ${memberNames[i]}`, nik, sourceRef: sref },
    });
    for (const p of periods) {
      const paid = (i + p.charCodeAt(6)) % 3 !== 0; // ±2/3 PAID — sisanya nunggak (cerita 61% UNPAID)
      await prisma.memberSaving.upsert({
        where: { memberId_type_period: { memberId: m.id, type: "WAJIB", period: p } },
        update: {},
        create: {
          memberId: m.id,
          type: "WAJIB" as SavingType,
          period: p,
          amount: 10_000,
          status: (paid ? "PAID" : "UNPAID") as SavingStatus,
          paidAt: paid ? daysAgo(-30) : null,
        },
      });
    }
    // kandidat imported (nikMasked) utk demo prefix-match saat registrasi
    await prisma.importedIdentity.upsert({
      where: { sourceRef: sref },
      update: {},
      create: {
        koperasiRef: DEMO_REF,
        sourceTable: "anggota_koperasi",
        sourceRef: sref,
        nama: `Bu/Pak ${memberNames[i]}`,
        nikMasked: nik ? `${nik.slice(0, 4)}**********${nik.slice(-2)}` : null,
        roleHint: "anggota",
      },
    });
  }
  console.log(`members: ${memberNames.length} × ${periods.length} periode simpanan`);

  // ---------- 6. Produk + opening stock (ADJUST) ----------
  for (const p of PRODUCTS) {
    const prod = await prisma.product.upsert({
      where: { koperasiId_nama: { koperasiId: kop.id, nama: p.nama } },
      update: {},
      create: { koperasiId: kop.id, nama: p.nama, unit: p.unit, hargaJual: p.hargaJual },
    });
    const existing = await prisma.stockMovement.findFirst({
      where: { productId: prod.id, type: "ADJUST" },
    });
    if (!existing) {
      await prisma.stockMovement.create({
        data: {
          koperasiId: kop.id,
          productId: prod.id,
          type: "ADJUST" as StockMoveType,
          qty: 20 + Math.floor(Math.random() * 30),
          date: daysAgo(-56),
          sourceChannel: "SEED" as EntrySource,
          status: "CONFIRMED" as EntryStatus,
          createdById: pengurus.id,
        },
      });
    }
  }
  console.log(`produk: ${PRODUCTS.length} + opening stock`);

  // ---------- 7. Jurnal 2 bulan (kosakata asli) ----------
  const count = await prisma.journalEntry.count({ where: { koperasiId: kop.id } });
  if (count === 0) {
    let n = 0;
    for (const [d, ket, unit, dr, cr, amt] of JOURNALS) {
      n += 1;
      await prisma.journalEntry.create({
        data: {
          koperasiId: kop.id,
          nomor: `JU-${String(n).padStart(3, "0")}`,
          date: daysAgo(d),
          keterangan: ket,
          businessUnitId: unit ? unitIds.get(unit) : undefined,
          sourceChannel: "SEED",
          status: "CONFIRMED",
          createdById: pengurus.id,
          lines: {
            create: [
              { coaId: coaId.get(dr)!, debit: amt, kredit: 0 },
              { coaId: coaId.get(cr)!, debit: 0, kredit: amt },
            ],
          },
        },
      });
    }
    console.log(`jurnal: ${n} entri (balanced)`);
  } else {
    console.log(`jurnal: sudah ada ${count} entri — skip`);
  }

  console.log("SEED SELESAI ✅  login demo: pengurus@kopra.id / kopra123");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
