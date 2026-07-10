export const rupiah = (v: string | number) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(Number(v));
export const num = (v: string | number) => new Intl.NumberFormat('id-ID').format(Number(v));
