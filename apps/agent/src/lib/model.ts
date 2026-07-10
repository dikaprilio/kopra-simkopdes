import { anthropic } from "@ai-sdk/anthropic";
import { createVertexAnthropic } from "@ai-sdk/google-vertex/anthropic";

/**
 * Pemilihan model Kopra.
 *
 * Prioritas Vertex AI (Claude on Google Cloud) via Application Default
 * Credentials — sesuai kebijakan org: TANPA API key, auth lewat ADC
 * (`gcloud auth application-default login`). Provider membaca kredensial
 * otomatis via google-auth-library.
 *
 * Env:
 *   GOOGLE_VERTEX_PROJECT   (wajib utk Vertex)  — project GCP yg meng-enable Claude
 *   GOOGLE_VERTEX_LOCATION  (default us-east5)  — region model garden
 *   KOPRA_MODEL_ID          — override id model (Vertex mis. "claude-sonnet-5@YYYYMMDD")
 *
 * Fallback dev lokal: kalau GOOGLE_VERTEX_PROJECT kosong tapi ANTHROPIC_API_KEY
 * ada, pakai Anthropic API langsung (hanya untuk uji lokal non-org).
 */
export function kopraModel() {
  const project = process.env.GOOGLE_VERTEX_PROJECT;
  const modelId = process.env.KOPRA_MODEL_ID;

  if (project) {
    const vertex = createVertexAnthropic({
      project,
      location: process.env.GOOGLE_VERTEX_LOCATION ?? "us-east5",
    });
    return vertex(modelId ?? "claude-sonnet-5");
  }

  if (process.env.ANTHROPIC_API_KEY) {
    return anthropic(modelId ?? "claude-opus-4-8");
  }

  throw new Error(
    "Model belum terkonfigurasi. Set GOOGLE_VERTEX_PROJECT (+ ADC via `gcloud auth application-default login`) " +
      "atau ANTHROPIC_API_KEY untuk dev lokal.",
  );
}
