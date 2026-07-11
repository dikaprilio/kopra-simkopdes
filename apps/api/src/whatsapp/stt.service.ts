import { Injectable, Logger } from '@nestjs/common';

/** Error STT yang bisa ditangani conversation (bukan crash pipeline). */
export class SttError extends Error {
  constructor(
    public code: 'TOO_LARGE' | 'UNCONFIGURED' | 'API_ERROR' | 'TIMEOUT',
    message: string,
  ) {
    super(message);
  }
}

const DEFAULT_MAX_BYTES = 5 * 1024 * 1024; // ±2 menit VN opus
const TIMEOUT_MS = 15_000;

/**
 * Azure Speech — Fast Transcription API (sinkron, terima OGG/Opus VN WhatsApp
 * tanpa konversi). Locale id-ID. Key/endpoint dari env, TIDAK pernah di-commit.
 */
@Injectable()
export class AzureSttService {
  private readonly logger = new Logger(AzureSttService.name);

  async transcribe(audio: Buffer, mime: string): Promise<string> {
    const key = process.env.AZURE_SPEECH_KEY;
    const endpoint = process.env.AZURE_SPEECH_ENDPOINT;
    if (!key || !endpoint) throw new SttError('UNCONFIGURED', 'AZURE_SPEECH_KEY/ENDPOINT belum di-set');

    const maxBytes = Number(process.env.STT_MAX_BYTES ?? DEFAULT_MAX_BYTES);
    if (audio.length > maxBytes)
      throw new SttError('TOO_LARGE', `Audio ${audio.length}B > batas ${maxBytes}B`);

    const form = new FormData();
    form.append('audio', new Blob([new Uint8Array(audio)], { type: mime }), 'voice.ogg');
    form.append(
      'definition',
      JSON.stringify({ locales: ['id-ID'], profanityFilterMode: 'None' }),
    );

    const url = `${endpoint.replace(/\/$/, '')}/speechtotext/transcriptions:transcribe?api-version=2024-11-15`;
    let res: Response;
    try {
      res = await fetch(url, {
        method: 'POST',
        headers: { 'Ocp-Apim-Subscription-Key': key },
        body: form,
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch (e) {
      if ((e as Error).name === 'TimeoutError')
        throw new SttError('TIMEOUT', `Azure STT timeout ${TIMEOUT_MS}ms`);
      throw new SttError('API_ERROR', (e as Error).message);
    }
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      throw new SttError('API_ERROR', `Azure STT ${res.status}: ${detail.slice(0, 200)}`);
    }
    const json = (await res.json()) as { combinedPhrases?: Array<{ text?: string }> };
    const text = json.combinedPhrases?.[0]?.text?.trim() ?? '';
    this.logger.log(`Transkrip ${audio.length}B → ${text.length} char`);
    return text;
  }
}
