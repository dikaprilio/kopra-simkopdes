import { execSync } from "node:child_process";
import { resolve } from "node:path";

const PSQL = `"C:/Program Files/PostgreSQL/18/bin/psql.exe"`;
const TEST_URL = "postgresql://postgres:admin@localhost:5432/kopra_test";

export default function setup() {
  // buat DB test bila belum ada
  try {
    execSync(
      `${PSQL} -h localhost -U postgres -tc "SELECT 1 FROM pg_database WHERE datname='kopra_test'" | findstr 1 || ${PSQL} -h localhost -U postgres -c "CREATE DATABASE kopra_test"`,
      { env: { ...process.env, PGPASSWORD: "admin" }, shell: "cmd.exe", stdio: "pipe" },
    );
  } catch {
    /* sudah ada */
  }
  // sync schema — jalankan dari packages/db supaya binary prisma lokal ketemu;
  // env DATABASE_URL menang atas packages/db/.env (aturan precedence prisma)
  execSync(`npx prisma db push --skip-generate`, {
    cwd: resolve(__dirname, "../../db"),
    env: { ...process.env, DATABASE_URL: TEST_URL },
    stdio: "pipe",
    shell: "cmd.exe",
  });
}
