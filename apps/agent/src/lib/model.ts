import { anthropic } from "@ai-sdk/anthropic";
import { createVertexAnthropic } from "@ai-sdk/google-vertex/anthropic";

/**
 * Pemilihan model Kopra — urutan prioritas:
 *
 * 1. OPENROUTER_API_KEY → OpenRouter via model-router bawaan Mastra
 *    (string "openrouter/<model>"; Mastra membaca OPENROUTER_API_KEY sendiri).
 *    Default: google/gemini-3.1-flash-lite. Override: KOPRA_MODEL_ID.
 * 2. GOOGLE_VERTEX_PROJECT → Claude di Vertex AI, auth ADC tanpa API key
 *    (`gcloud auth application-default login`). Region: GOOGLE_VERTEX_LOCATION.
 * 3. ANTHROPIC_API_KEY → Anthropic API langsung (dev lokal saja).
 */
export function kopraModel() {
  if (process.env.OPENROUTER_API_KEY) {
    const id = process.env.KOPRA_MODEL_ID ?? "google/gemini-3.1-flash-lite";
    return `openrouter/${id}` as const;
  }

  const project = process.env.GOOGLE_VERTEX_PROJECT;
  if (project) {
    const vertex = createVertexAnthropic({
      project,
      location: process.env.GOOGLE_VERTEX_LOCATION ?? "us-east5",
    });
    return vertex(process.env.KOPRA_MODEL_ID ?? "claude-sonnet-5");
  }

  if (process.env.ANTHROPIC_API_KEY) {
    return anthropic(process.env.KOPRA_MODEL_ID ?? "claude-opus-4-8");
  }

  throw new Error(
    "Model belum terkonfigurasi. Set OPENROUTER_API_KEY, atau GOOGLE_VERTEX_PROJECT (+ADC), " +
      "atau ANTHROPIC_API_KEY.",
  );
}
