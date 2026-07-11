/**
 * Posting rules deterministik — "chat masuk, jurnal CORE-standard keluar".
 * Pengurus TIDAK pernah melihat debit/kredit; fungsi ini yang menerjemahkan.
 * PURE (tanpa DB) supaya gampang di-test. Resolusi kode→id dilakukan journal.ts.
 */

export type EntryKind =
  | "INCOME"
  | "EXPENSE"
  | "STOCK_PURCHASE"
  | "STOCK_SALE"
  | "SAVING_PAYMENT";

export interface SimpleEntryInput {
  koperasiId: string;
  kind: EntryKind;
  /** nominal total; utk STOCK_* boleh dihitung dari qty×harga */
  amount?: number;
  description: string;
  date?: Date;
  businessUnitId?: string;
  via?: "KAS" | "BANK"; // default KAS
  /** kode akun pendapatan hasil resolve unit (mis. 413000 utk BANEW); default 410000 */
  revenueCoaKode?: string;
  meta?: {
    productId?: string;
    qty?: number;
    hargaBeli?: number;
    hargaJual?: number;
    memberId?: string;
    periods?: string[]; // ["2026-04","2026-05"]
    savingType?: "POKOK" | "WAJIB";
  };
}

export interface PostingLine {
  coaKode: string;
  debit: number;
  kredit: number;
  catatan?: string;
}

export const KODE = {
  KAS: "111000",
  BANK: "112100",
  PERSEDIAAN: "114000",
  SIMPANAN_POKOK: "310000",
  SIMPANAN_WAJIB: "320000",
  PENDAPATAN_PENJUALAN: "410000",
  BEBAN_OPERASIONAL: "510000",
} as const;

export class PostingError extends Error {
  constructor(public code: string, message: string) {
    super(message);
  }
}

function viaKode(input: SimpleEntryInput): string {
  return input.via === "BANK" ? KODE.BANK : KODE.KAS;
}

/** Hitung nominal efektif (utk STOCK_* dari qty×harga bila amount kosong). */
export function effectiveAmount(input: SimpleEntryInput): number {
  const m = input.meta ?? {};
  if (input.kind === "STOCK_PURCHASE" && m.qty && m.hargaBeli)
    return m.qty * m.hargaBeli;
  if (input.kind === "STOCK_SALE" && m.qty && m.hargaJual)
    return m.qty * m.hargaJual;
  if (input.amount && input.amount > 0) return input.amount;
  throw new PostingError("AMOUNT_REQUIRED", "Nominal transaksi tidak ditemukan/nol.");
}

/** Bangun baris jurnal balanced. SUM(debit) === SUM(kredit) dijamin konstruksi. */
export function buildLines(input: SimpleEntryInput): PostingLine[] {
  const amt = effectiveAmount(input);
  const via = viaKode(input);
  switch (input.kind) {
    case "INCOME":
      return [
        { coaKode: via, debit: amt, kredit: 0 },
        { coaKode: input.revenueCoaKode ?? KODE.PENDAPATAN_PENJUALAN, debit: 0, kredit: amt },
      ];
    case "EXPENSE":
      return [
        { coaKode: KODE.BEBAN_OPERASIONAL, debit: amt, kredit: 0 },
        { coaKode: via, debit: 0, kredit: amt },
      ];
    case "STOCK_PURCHASE":
      return [
        { coaKode: KODE.PERSEDIAAN, debit: amt, kredit: 0 },
        { coaKode: via, debit: 0, kredit: amt },
      ];
    case "STOCK_SALE":
      return [
        { coaKode: via, debit: amt, kredit: 0 },
        { coaKode: input.revenueCoaKode ?? KODE.PENDAPATAN_PENJUALAN, debit: 0, kredit: amt },
      ];
    case "SAVING_PAYMENT": {
      const st = input.meta?.savingType ?? "WAJIB";
      return [
        { coaKode: via, debit: amt, kredit: 0 },
        {
          coaKode: st === "POKOK" ? KODE.SIMPANAN_POKOK : KODE.SIMPANAN_WAJIB,
          debit: 0,
          kredit: amt,
        },
      ];
    }
  }
}

/** Validasi balanced utk jurnal MANUAL (lines dari user/web). */
export function assertBalanced(lines: PostingLine[]): void {
  const d = lines.reduce((s, l) => s + l.debit, 0);
  const k = lines.reduce((s, l) => s + l.kredit, 0);
  if (lines.length < 2) throw new PostingError("LINES_MIN", "Jurnal minimal 2 baris.");
  if (Math.abs(d - k) > 0.005)
    throw new PostingError("NOT_BALANCED", `Debit (${d}) ≠ Kredit (${k}).`);
  for (const l of lines)
    if ((l.debit > 0) === (l.kredit > 0))
      throw new PostingError("LINE_INVALID", "Tiap baris hanya salah satu debit/kredit.");
}
