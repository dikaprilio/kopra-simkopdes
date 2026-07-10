/**
 * Import 1 koperasi NYATA dari mirror lokal DB panitia → tabel Kopra.
 * Momen demo "onboarding dari data resmi dalam satu perintah".
 *
 *   SOURCE_DATABASE_URL=... pnpm --filter @kopra/db import:koperasi -- --ref KOP-XXXX
 *
 * Mengisi: Koperasi (IMPORTED) · Member (+MemberSaving per periode, status asli
 * PAID/UNPAID) · ImportedIdentity (anggota+pengurus, nikMasked utk prefix-match)
 * · Product (+opening tak dibuat — stok resmi tidak tersedia andal).
 * Runtime TIDAK pernah menyentuh DB panitia — script offline ini satu-satunya jalur.
 */
import { Client } from "pg";
import { prisma } from "./index";
import { DEFAULT_COA } from "./coa-default";

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function main() {
  const ref = arg("ref");
  const url = process.env.SOURCE_DATABASE_URL;
  if (!ref) throw new Error("--ref KOP-XXXX wajib");
  if (!url) {
    console.error("SOURCE_DATABASE_URL tidak di-set — mirror tidak tersedia.");
    console.error("Di VPS: pakai auto-onboard dari koperasi_directory (tanpa data anggota).");
    process.exit(2);
  }
  const src = new Client({ connectionString: url });
  await src.connect();

  // ---- profil ----
  const prof = await src.query(
    `SELECT koperasi_ref, nama_koperasi, alamat_lengkap FROM profil_koperasi WHERE koperasi_ref = $1`,
    [ref],
  );
  if (prof.rowCount === 0) throw new Error(`koperasi ${ref} tidak ditemukan di mirror`);
  const p = prof.rows[0];

  const kop = await prisma.koperasi.upsert({
    where: { sourceRef: ref },
    update: { nama: p.nama_koperasi },
    create: {
      nama: p.nama_koperasi,
      sourceRef: ref,
      origin: "IMPORTED",
      status: "ACTIVE",
      managementMode: "SUPER_ADMIN",
    },
  });

  // COA default kalau belum ada
  const coaCount = await prisma.coaAccount.count({ where: { koperasiId: kop.id } });
  if (coaCount === 0) {
    const idByKode = new Map<string, string>();
    for (const c of DEFAULT_COA) {
      const row = await prisma.coaAccount.create({
        data: {
          koperasiId: kop.id, kode: c.kode, nama: c.nama, type: c.type,
          parentId: c.parentKode ? idByKode.get(c.parentKode) : undefined,
        },
      });
      idByKode.set(c.kode, row.id);
    }
  }

  // ---- anggota (+ImportedIdentity) ----
  const anggota = await src.query(
    `SELECT anggota_ref, nama, nik FROM anggota_koperasi WHERE koperasi_ref = $1`,
    [ref],
  );
  for (const a of anggota.rows) {
    await prisma.member.upsert({
      where: { sourceRef: a.anggota_ref },
      update: {},
      create: { koperasiId: kop.id, nama: a.nama, nik: a.nik ?? null, sourceRef: a.anggota_ref },
    });
    await prisma.importedIdentity.upsert({
      where: { sourceRef: a.anggota_ref },
      update: {},
      create: {
        koperasiRef: ref, sourceTable: "anggota_koperasi", sourceRef: a.anggota_ref,
        nama: a.nama, nikMasked: a.nik ?? null, roleHint: "anggota",
      },
    });
  }

  // ---- pengurus → ImportedIdentity (kandidat approval) ----
  const pengurus = await src.query(
    `SELECT pengurus_ref, nama, nik, jabatan FROM pengurus_koperasi WHERE koperasi_ref = $1`,
    [ref],
  );
  for (const g of pengurus.rows) {
    await prisma.importedIdentity.upsert({
      where: { sourceRef: g.pengurus_ref },
      update: {},
      create: {
        koperasiRef: ref, sourceTable: "pengurus_koperasi", sourceRef: g.pengurus_ref,
        nama: g.nama, nikMasked: g.nik ?? null, roleHint: g.jabatan ?? "pengurus",
      },
    });
  }

  // ---- simpanan per periode (status asli) ----
  const simp = await src.query(
    `SELECT s.simpanan_ref, s.anggota_ref, s.periode_pembayaran, s.jumlah_simpanan, s.status, s.dibayar_pada
     FROM simpanan_anggota s WHERE s.koperasi_ref = $1`,
    [ref],
  );
  let saved = 0;
  for (const s of simp.rows) {
    const member = await prisma.member.findUnique({ where: { sourceRef: s.anggota_ref } });
    if (!member) continue;
    const period = String(s.periode_pembayaran ?? "").slice(0, 7) || "2026-01";
    await prisma.memberSaving.upsert({
      where: { memberId_type_period: { memberId: member.id, type: "WAJIB", period } },
      update: { status: s.status === "PAID" ? "PAID" : "UNPAID" },
      create: {
        memberId: member.id, type: "WAJIB", period,
        amount: s.jumlah_simpanan ?? 0,
        status: s.status === "PAID" ? "PAID" : "UNPAID",
        paidAt: s.dibayar_pada ?? null,
      },
    });
    saved++;
  }

  // ---- produk ----
  const prods = await src.query(
    `SELECT produk_sample_id, nama_produk, kode_barcode FROM produk_koperasi WHERE koperasi_ref = $1`,
    [ref],
  );
  for (const pr of prods.rows) {
    await prisma.product.upsert({
      where: { sourceRef: pr.produk_sample_id },
      update: {},
      create: {
        koperasiId: kop.id,
        nama: pr.nama_produk,
        barcode: pr.kode_barcode ?? null,
        sourceRef: pr.produk_sample_id,
      },
    }).catch(async () => {
      // nama duplikat dalam koperasi (data resmi kadang dobel) → skip
    });
  }

  await src.end();
  console.log(
    `IMPORT ${ref} → "${kop.nama}": anggota ${anggota.rowCount}, pengurus ${pengurus.rowCount}, simpanan ${saved}, produk ${prods.rowCount}`,
  );
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
