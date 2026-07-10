import type { CoaType } from "@prisma/client";

export interface CoaSeed {
  kode: string;
  nama: string;
  type: CoaType;
  parentKode?: string;
}

/**
 * COA default KDMP — subset contoh aplikasi "Koperasi Merah Putih CORE"
 * (lihat docs/data/kdmp-modules-tutorial/01-koperasi-merah-putih-core.md).
 * Posting rules (packages/core) merujuk kode-kode ini.
 */
export const DEFAULT_COA: CoaSeed[] = [
  // 1xxxxx AKTIVA
  { kode: "100000", nama: "AKTIVA", type: "ASSET" },
  { kode: "111000", nama: "Kas Rupiah", type: "ASSET", parentKode: "100000" },
  { kode: "112100", nama: "Bank BRI", type: "ASSET", parentKode: "100000" },
  { kode: "113000", nama: "Piutang", type: "ASSET", parentKode: "100000" },
  { kode: "114000", nama: "Persediaan", type: "ASSET", parentKode: "100000" },
  // 2xxxxx KEWAJIBAN
  { kode: "200000", nama: "KEWAJIBAN", type: "LIABILITY" },
  { kode: "210000", nama: "Hutang Pihak Ketiga", type: "LIABILITY", parentKode: "200000" },
  // 3xxxxx EKUITAS
  { kode: "300000", nama: "EKUITAS", type: "EQUITY" },
  { kode: "310000", nama: "Simpanan Pokok", type: "EQUITY", parentKode: "300000" },
  { kode: "320000", nama: "Simpanan Wajib", type: "EQUITY", parentKode: "300000" },
  // 4xxxxx PENDAPATAN (anak per unit usaha dibuat dinamis saat seed/onboard)
  { kode: "400000", nama: "PENDAPATAN", type: "REVENUE" },
  { kode: "410000", nama: "Pendapatan Penjualan", type: "REVENUE", parentKode: "400000" },
  // 5xxxxx BEBAN
  { kode: "500000", nama: "BEBAN", type: "EXPENSE" },
  { kode: "510000", nama: "Beban Operasional", type: "EXPENSE", parentKode: "500000" },
  { kode: "520000", nama: "Beban Administrasi Bank", type: "EXPENSE", parentKode: "500000" },
];

/** Kode akun pendapatan per unit usaha: 411000, 412000, … (urutan unit). */
export function unitRevenueKode(index: number): string {
  return `4${String(11 + index).padStart(2, "0")}000`;
}
