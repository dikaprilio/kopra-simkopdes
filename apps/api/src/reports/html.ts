const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export function renderReportHtml(title: string, headers: string[], rows: (string | number)[][], footer?: string): string {
  const fmt = (v: string | number) => (typeof v === 'number' ? new Intl.NumberFormat('id-ID').format(v) : esc(v));
  const th = headers.map((h) => `<th>${esc(h)}</th>`).join('');
  const tr = rows.map((r) => `<tr>${r.map((c) => `<td>${fmt(c)}</td>`).join('')}</tr>`).join('');
  return `<!doctype html><meta charset="utf-8"><title>${esc(title)}</title>
<style>body{font:14px/1.5 system-ui;margin:32px;color:#111}h1{font-size:18px}table{border-collapse:collapse;width:100%}th,td{border:1px solid #ccc;padding:6px 10px;text-align:left}td:not(:first-child):not(:nth-child(2)){text-align:right}@media print{button{display:none}}</style>
<h1>${esc(title)}</h1><button onclick="print()">Cetak</button>
<table><thead><tr>${th}</tr></thead><tbody>${tr}</tbody></table>${footer ? `<p><strong>${esc(footer)}</strong></p>` : ''}`;
}
