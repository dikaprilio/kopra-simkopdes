import { describe, expect, it } from "vitest";
import {
  buildLines,
  assertBalanced,
  effectiveAmount,
  PostingError,
  type SimpleEntryInput,
} from "./posting-rules.js";

const base = { koperasiId: "kop1", description: "tes" };
const sum = (ls: { debit: number; kredit: number }[]) => ({
  d: ls.reduce((s, l) => s + l.debit, 0),
  k: ls.reduce((s, l) => s + l.kredit, 0),
});

describe("posting rules — tabel spec §2", () => {
  it("INCOME banyu 500rb → Dr Kas / Cr Pendapatan unit", () => {
    const ls = buildLines({
      ...base, kind: "INCOME", amount: 500_000, revenueCoaKode: "413000",
    } as SimpleEntryInput);
    expect(ls).toEqual([
      { coaKode: "111000", debit: 500_000, kredit: 0 },
      { coaKode: "413000", debit: 0, kredit: 500_000 },
    ]);
  });

  it("INCOME via BANK → Dr 112100", () => {
    const ls = buildLines({ ...base, kind: "INCOME", amount: 450_000, via: "BANK" } as SimpleEntryInput);
    expect(ls[0].coaKode).toBe("112100");
  });

  it("EXPENSE listrik 200rb → Dr Beban / Cr Kas", () => {
    const ls = buildLines({ ...base, kind: "EXPENSE", amount: 200_000 } as SimpleEntryInput);
    expect(ls).toEqual([
      { coaKode: "510000", debit: 200_000, kredit: 0 },
      { coaKode: "111000", debit: 0, kredit: 200_000 },
    ]);
  });

  it("STOCK_PURCHASE 20×14rb → Dr Persediaan 280rb / Cr Kas", () => {
    const ls = buildLines({
      ...base, kind: "STOCK_PURCHASE", meta: { qty: 20, hargaBeli: 14_000 },
    } as SimpleEntryInput);
    expect(ls[0]).toEqual({ coaKode: "114000", debit: 280_000, kredit: 0 });
    expect(ls[1].kredit).toBe(280_000);
  });

  it("STOCK_SALE 5×15500 → Dr Kas 77.500 / Cr Pendapatan Penjualan", () => {
    const ls = buildLines({
      ...base, kind: "STOCK_SALE", meta: { qty: 5, hargaJual: 15_500 },
    } as SimpleEntryInput);
    expect(ls[0]).toEqual({ coaKode: "111000", debit: 77_500, kredit: 0 });
    expect(ls[1].coaKode).toBe("410000");
  });

  it("SAVING_PAYMENT wajib 3 periode 30rb → Cr 320000; pokok → Cr 310000", () => {
    const w = buildLines({
      ...base, kind: "SAVING_PAYMENT", amount: 30_000,
      meta: { savingType: "WAJIB", periods: ["2026-04", "2026-05", "2026-06"] },
    } as SimpleEntryInput);
    expect(w[1].coaKode).toBe("320000");
    const p = buildLines({
      ...base, kind: "SAVING_PAYMENT", amount: 100_000, meta: { savingType: "POKOK" },
    } as SimpleEntryInput);
    expect(p[1].coaKode).toBe("310000");
  });

  it("SEMUA kind menghasilkan jurnal balanced", () => {
    const cases: SimpleEntryInput[] = [
      { ...base, kind: "INCOME", amount: 1 } as SimpleEntryInput,
      { ...base, kind: "EXPENSE", amount: 99.5 } as SimpleEntryInput,
      { ...base, kind: "STOCK_PURCHASE", meta: { qty: 3, hargaBeli: 333 } } as SimpleEntryInput,
      { ...base, kind: "STOCK_SALE", meta: { qty: 7, hargaJual: 111 } } as SimpleEntryInput,
      { ...base, kind: "SAVING_PAYMENT", amount: 10_000 } as SimpleEntryInput,
    ];
    for (const c of cases) {
      const { d, k } = sum(buildLines(c));
      expect(d).toBeCloseTo(k, 2);
      expect(d).toBeGreaterThan(0);
    }
  });

  it("amount 0/absen → PostingError AMOUNT_REQUIRED", () => {
    expect(() => effectiveAmount({ ...base, kind: "INCOME" } as SimpleEntryInput)).toThrow(PostingError);
    expect(() => buildLines({ ...base, kind: "EXPENSE", amount: 0 } as SimpleEntryInput)).toThrow();
  });
});

describe("assertBalanced (jurnal manual)", () => {
  it("terima balanced, tolak timpang & baris ganda-sisi", () => {
    assertBalanced([
      { coaKode: "111000", debit: 100, kredit: 0 },
      { coaKode: "410000", debit: 0, kredit: 100 },
    ]);
    expect(() =>
      assertBalanced([
        { coaKode: "111000", debit: 100, kredit: 0 },
        { coaKode: "410000", debit: 0, kredit: 90 },
      ]),
    ).toThrow(/NOT_BALANCED|≠/);
    expect(() =>
      assertBalanced([
        { coaKode: "111000", debit: 100, kredit: 100 },
        { coaKode: "410000", debit: 0, kredit: 0 },
      ]),
    ).toThrow();
  });
});
