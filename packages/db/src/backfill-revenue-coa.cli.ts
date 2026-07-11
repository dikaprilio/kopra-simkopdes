import { prisma } from "./index";
import { backfillBusinessUnitRevenueCoa } from "./backfill-revenue-coa";

async function main() {
  const result = await backfillBusinessUnitRevenueCoa();
  console.log(
    `Revenue COA backfill: scanned=${result.scanned} linked=${result.linked} unchanged=${result.unchanged}`,
  );
  for (const item of result.unmatched) {
    console.warn(
      `UNMATCHED unit=${item.unitId} koperasi=${item.koperasiId} expected=${JSON.stringify(item.expectedCoaName)}`,
    );
  }
  for (const item of result.ambiguous) {
    console.warn(
      `AMBIGUOUS unit=${item.unitId} koperasi=${item.koperasiId} reason=${item.reason} candidates=${item.candidateCoaIds.join(",")}`,
    );
  }
  if (result.unmatched.length || result.ambiguous.length) process.exitCode = 2;
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
