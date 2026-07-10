// jest setupFiles — jalan sebelum module di-load.
// Spec ber-DB memakai DB test yang sama dengan vitest @kopra/core (kopra_test,
// schema sudah di-push oleh global-setup core).
process.env.DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? 'postgresql://postgres:admin@localhost:5432/kopra_test';
process.env.WA_WEBHOOK_SECRET = 'kopra-webhook-dev-secret';
process.env.WA_OUTBOX_DISABLED = '1'; // jangan nyalakan worker interval di test
