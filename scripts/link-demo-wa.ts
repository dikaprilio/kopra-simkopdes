/**
 * Link nomor WA demo → user seed (utk uji fake-webhook / demo tanpa registrasi M6).
 *   pnpm --filter @kopra/db exec tsx ../../scripts/link-demo-wa.ts 62811111 pengurus@kopra.id
 */
import { prisma } from "../packages/db/src/index";

async function main() {
  const [waNumber, email] = process.argv.slice(2);
  if (!waNumber || !email) {
    console.error("usage: tsx scripts/link-demo-wa.ts <waNumber> <email>");
    process.exit(1);
  }
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user?.koperasiId) throw new Error(`user ${email} tidak ditemukan / tanpa koperasi`);
  await prisma.whatsappIdentity.upsert({
    where: { waNumber },
    update: { userId: user.id, koperasiId: user.koperasiId },
    create: { waNumber, userId: user.id, koperasiId: user.koperasiId },
  });
  console.log(`linked ${waNumber} → ${email} (${user.role}, koperasi ${user.koperasiId})`);
  await prisma.$disconnect();
}
main();
