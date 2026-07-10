/**
 * Generate seed-data/koperasi-directory.json dari mirror lokal DB panitia.
 * Jalankan SEKALI di mesin dev yang punya mirror (localhost:5432):
 *   SOURCE_DATABASE_URL=postgresql://... pnpm --filter @kopra/db gen:directory
 * Output di-COMMIT (nama koperasi = data publik, PII-free).
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { Client } from "pg";

async function main() {
  const url = process.env.SOURCE_DATABASE_URL;
  if (!url) throw new Error("SOURCE_DATABASE_URL belum di-set (mirror data panitia)");
  const client = new Client({ connectionString: url });
  await client.connect();
  const { rows } = await client.query(`
    SELECT p.koperasi_ref AS "sourceRef",
           p.nama_koperasi AS "nama",
           NULLIF(TRIM(COALESCE(w.kode_wilayah, '')), '') AS "wilayah"
    FROM profil_koperasi p
    LEFT JOIN referensi_koperasi_wilayah w ON w.koperasi_ref = p.koperasi_ref
    ORDER BY p.nama_koperasi
  `);
  await client.end();

  const dir = join(__dirname, "..", "seed-data");
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "koperasi-directory.json"), JSON.stringify(rows, null, 1), "utf-8");
  console.log(`koperasi-directory.json ditulis: ${rows.length} koperasi`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
