import { defineConfig } from "vitest/config";
import { resolve } from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@kopra/db": resolve(__dirname, "../db/src/index.ts"),
    },
  },
  test: {
    environment: "node",
    globalSetup: "./test/global-setup.ts",
    env: {
      // DB test terpisah — jangan sentuh DB dev "kopra".
      // TEST_DATABASE_URL harus konsisten dgn test/global-setup.ts (push schema).
      DATABASE_URL:
        process.env.TEST_DATABASE_URL ?? "postgresql://postgres:admin@localhost:5432/kopra_test",
      PENDING_ACTION_TTL_SECONDS: "900",
    },
    pool: "forks",
    poolOptions: { forks: { singleFork: true } }, // serial: hindari race di DB test
    testTimeout: 30000,
  },
});
