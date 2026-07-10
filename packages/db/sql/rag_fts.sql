-- FTS untuk rag_documents (Prisma tak bisa express generated tsvector).
-- Config 'simple' (dictionary 'indonesian' tak tersedia di Postgres vanilla).
ALTER TABLE rag_documents ADD COLUMN IF NOT EXISTS tsv tsvector
  GENERATED ALWAYS AS (to_tsvector('simple', coalesce(title,'') || ' ' || coalesce(content,''))) STORED;
CREATE INDEX IF NOT EXISTS rag_documents_tsv_idx ON rag_documents USING GIN (tsv)
