import { execSync } from "node:child_process";
import { resolve } from "node:path";

// URL DB test — password diabaikan oleh trust auth (macOS Postgres.app) tapi
// tetap ditulis utk kompatibilitas mesin dev Windows (password 'admin').
const TEST_URL =
  process.env.TEST_DATABASE_URL ?? "postgresql://postgres:admin@localhost:5432/kopra_test";

export default async function setup() {
  // buat DB test bila belum ada — pakai pg client (cross-platform, tanpa psql)
  const { Client } = await import("pg");
  const adminUrl = new URL(TEST_URL);
  const dbName = adminUrl.pathname.slice(1);
  adminUrl.pathname = "/postgres";
  const client = new Client({ connectionString: adminUrl.toString() });
  await client.connect();
  const r = await client.query("SELECT 1 FROM pg_database WHERE datname = $1", [dbName]);
  if (r.rowCount === 0) await client.query(`CREATE DATABASE ${dbName}`);
  await client.end();
  // sync schema — cwd packages/db supaya binary prisma lokal ketemu;
  // env DATABASE_URL menang atas .env (aturan precedence prisma)
  execSync("pnpm run push -- --skip-generate", {
    cwd: resolve(__dirname, "../../db"),
    env: { ...process.env, DATABASE_URL: TEST_URL },
    stdio: "pipe",
  });
}
