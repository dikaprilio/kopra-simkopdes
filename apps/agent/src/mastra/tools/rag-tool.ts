import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { prisma } from "@kopra/db";
import { can } from "@kopra/core";
import { getActor } from "../../lib/context";

interface RagHit {
  title: string;
  source: string;
  sourceType: string;
  snippet: string;
  rank: number;
}

/**
 * RAG P1 = Postgres FTS (tsvector 'simple' + GIN) — pgvector menyusul saat deploy.
 * Korpus: panduan pembukuan, UU 25/1992, FAQ KDMP, tutorial modul CORE, riset lapangan.
 */
export const searchCooperativeGuidance = createTool({
  id: "searchCooperativeGuidance",
  description:
    "Cari panduan/regulasi koperasi (pembukuan, simpanan, SHU, RAT, UU 25/1992, cara pakai aplikasi CORE/SIMKOPDES). Pakai utk SEMUA pertanyaan pengetahuan — jangan menjawab dari ingatan. Sebut 'source' di jawaban.",
  inputSchema: z.object({
    query: z.string().describe("kata kunci bahasa Indonesia, tanpa kata tanya"),
  }),
  execute: async (input, ctx) => {
    const actor = getActor(ctx?.requestContext);
    if (!can(actor.role, "PUBLIC_QA", actor.channel))
      return { denied: "Akun ini khusus perintah administrasi." };

    const q = input.query;
    let hits = await prisma.$queryRaw<RagHit[]>`
      SELECT title, source, "sourceType",
             left(content, 700) AS snippet,
             ts_rank(tsv, plainto_tsquery('simple', ${q}))::float AS rank
      FROM rag_documents
      WHERE tsv @@ plainto_tsquery('simple', ${q})
      ORDER BY rank DESC
      LIMIT 5`;

    if (hits.length === 0) {
      // fallback ILIKE per kata (FTS 'simple' tidak stemming bahasa Indonesia)
      const words = q.split(/\s+/).filter((w) => w.length >= 4).slice(0, 3);
      if (words.length) {
        hits = await prisma.$queryRaw<RagHit[]>`
          SELECT title, source, "sourceType", left(content, 700) AS snippet, 0::float AS rank
          FROM rag_documents
          WHERE content ILIKE ANY(${words.map((w) => `%${w}%`)})
          LIMIT 5`;
      }
    }

    if (hits.length === 0)
      return { found: false, note: "Tidak ada panduan yang cocok — katakan jujur bahwa kamu tidak menemukan sumbernya." };
    return {
      found: true,
      results: hits.map((h) => ({
        title: h.title,
        source: h.source,
        jenis: h.sourceType,
        cuplikan: h.snippet,
      })),
    };
  },
});
