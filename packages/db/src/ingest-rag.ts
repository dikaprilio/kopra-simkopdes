/**
 * Ingest korpus RAG → rag_documents (FTS 'simple', kolom tsv generated).
 * Idempotent: hapus per-source lalu re-insert (aman dijalankan berulang).
 *   pnpm --filter @kopra/db ingest:rag
 */
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join, basename } from "node:path";
import { prisma } from "./index";

const ROOT = join(__dirname, "../../..");

interface SourceSpec {
  path: string; // relatif ROOT
  sourceType: string; // fallback bila frontmatter tak menyebut
}

const SOURCES: SourceSpec[] = [
  // panduan & regulasi (rag_corpus top-level)
  ...mdFiles("rag_corpus", "guide"),
  // tutorial modul aplikasi resmi KDMP
  ...mdFiles("docs/data/kdmp-modules-tutorial", "module_tutorial"),
  // riset lapangan (interview + berkas anonim + LPJ transkrip)
  { path: "docs/riset-lapangan/interview_notes_pak_tejo_kdmp_palbapang.md", sourceType: "field_research" },
  { path: "docs/riset-lapangan/interview_notes_bu_anita_kdmp_bangunharjo.md", sourceType: "field_research" },
  { path: "docs/riset-lapangan/berkas-lapangan-anonim.md", sourceType: "field_research" },
  { path: "rag_corpus/raw/lpj-rat-bangunharjo-2025-transkrip.md", sourceType: "field_research" },
];

function mdFiles(dir: string, sourceType: string): SourceSpec[] {
  const abs = join(ROOT, dir);
  if (!existsSync(abs)) return [];
  return readdirSync(abs)
    .filter((f) => f.endsWith(".md") && !/^(README|SOURCES)/i.test(f))
    .map((f) => ({ path: `${dir}/${f}`, sourceType }));
}

/** frontmatter YAML minimal: ambil title & sourceType bila ada. */
function parseFrontmatter(raw: string): { meta: Record<string, string>; body: string } {
  const m = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n/);
  if (!m) return { meta: {}, body: raw };
  const meta: Record<string, string> = {};
  for (const line of m[1].split(/\r?\n/)) {
    const kv = line.match(/^([A-Za-z_]+):\s*(.+)$/);
    if (kv) meta[kv[1]] = kv[2].trim();
  }
  return { meta, body: raw.slice(m[0].length) };
}

interface Chunk {
  heading: string;
  text: string;
}

/** Pecah per heading (## / #), gabung yang kecil, belah yang >800 kata (overlap 100). */
function chunkByHeading(body: string, maxWords = 800, overlap = 100): Chunk[] {
  const sections: Chunk[] = [];
  let current: Chunk = { heading: "", text: "" };
  for (const line of body.split(/\r?\n/)) {
    const h = line.match(/^#{1,3}\s+(.*)$/);
    if (h) {
      if (current.text.trim()) sections.push(current);
      current = { heading: h[1].trim(), text: line + "\n" };
    } else {
      current.text += line + "\n";
    }
  }
  if (current.text.trim()) sections.push(current);

  // gabungkan section pendek berurutan (biar chunk tidak recehan)
  const merged: Chunk[] = [];
  for (const s of sections) {
    const last = merged[merged.length - 1];
    if (last && wordCount(last.text) + wordCount(s.text) <= maxWords) {
      last.text += "\n" + s.text;
      if (!last.heading) last.heading = s.heading;
    } else {
      merged.push({ ...s });
    }
  }

  // belah yang kepanjangan dengan overlap
  const out: Chunk[] = [];
  for (const s of merged) {
    const words = s.text.split(/\s+/);
    if (words.length <= maxWords) {
      out.push(s);
      continue;
    }
    for (let i = 0, part = 1; i < words.length; i += maxWords - overlap, part++) {
      out.push({
        heading: `${s.heading} (bag. ${part})`,
        text: words.slice(i, i + maxWords).join(" "),
      });
      if (i + maxWords >= words.length) break;
    }
  }
  return out;
}

const wordCount = (t: string) => t.split(/\s+/).filter(Boolean).length;

async function main() {
  let total = 0;
  for (const spec of SOURCES) {
    const abs = join(ROOT, spec.path);
    if (!existsSync(abs)) {
      console.warn(`lewati (tidak ada): ${spec.path}`);
      continue;
    }
    const raw = readFileSync(abs, "utf8");
    const { meta, body } = parseFrontmatter(raw);
    const docTitle = meta.title ?? basename(spec.path, ".md");
    const sourceType = meta.sourceType ?? spec.sourceType;
    const chunks = chunkByHeading(body);

    await prisma.ragDocument.deleteMany({ where: { source: spec.path } });
    await prisma.ragDocument.createMany({
      data: chunks.map((c) => ({
        title: c.heading ? `${docTitle} — ${c.heading}` : docTitle,
        source: spec.path,
        sourceType,
        content: c.text.trim(),
      })),
    });
    total += chunks.length;
    console.log(`${spec.path}: ${chunks.length} chunk (${sourceType})`);
  }
  const n = await prisma.ragDocument.count();
  console.log(`\nselesai: ${total} chunk di-ingest, total rag_documents = ${n}`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
