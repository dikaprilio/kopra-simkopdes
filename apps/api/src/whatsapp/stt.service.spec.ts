import { AzureSttService, SttError } from './stt.service';

describe('AzureSttService', () => {
  const svc = new AzureSttService();
  const audio = Buffer.from('fake-ogg-opus');
  const origFetch = global.fetch;

  beforeEach(() => {
    process.env.AZURE_SPEECH_KEY = 'test-key';
    process.env.AZURE_SPEECH_ENDPOINT = 'https://southeastasia.api.cognitive.microsoft.com';
    process.env.STT_MAX_BYTES = '5242880';
  });

  afterEach(() => {
    global.fetch = origFetch;
  });

  it('sukses → teks combinedPhrases, URL & header benar', async () => {
    let seenUrl = '';
    let seenKey = '';
    global.fetch = jest.fn(async (url: unknown, init?: RequestInit) => {
      seenUrl = String(url);
      seenKey = (init?.headers as Record<string, string>)['Ocp-Apim-Subscription-Key'];
      return new Response(
        JSON.stringify({ combinedPhrases: [{ text: 'catat pemasukan gerai seratus ribu' }] }),
        { status: 200 },
      );
    }) as typeof fetch;

    await expect(svc.transcribe(audio, 'audio/ogg')).resolves.toBe(
      'catat pemasukan gerai seratus ribu',
    );
    expect(seenUrl).toBe(
      'https://southeastasia.api.cognitive.microsoft.com/speechtotext/transcriptions:transcribe?api-version=2024-11-15',
    );
    expect(seenKey).toBe('test-key');
  });

  it('hasil kosong → string kosong (bukan error)', async () => {
    global.fetch = jest.fn(async () =>
      new Response(JSON.stringify({ combinedPhrases: [] }), { status: 200 }),
    ) as typeof fetch;
    await expect(svc.transcribe(audio, 'audio/ogg')).resolves.toBe('');
  });

  it('non-200 → SttError API_ERROR', async () => {
    global.fetch = jest.fn(async () => new Response('bad audio', { status: 400 })) as typeof fetch;
    await expect(svc.transcribe(audio, 'audio/ogg')).rejects.toMatchObject({
      code: 'API_ERROR',
    });
  });

  it('audio melebihi STT_MAX_BYTES → TOO_LARGE tanpa memanggil API', async () => {
    process.env.STT_MAX_BYTES = '4';
    const spy = jest.fn();
    global.fetch = spy as unknown as typeof fetch;
    await expect(svc.transcribe(audio, 'audio/ogg')).rejects.toMatchObject({ code: 'TOO_LARGE' });
    expect(spy).not.toHaveBeenCalled();
  });

  it('env kosong → UNCONFIGURED', async () => {
    delete process.env.AZURE_SPEECH_KEY;
    await expect(svc.transcribe(audio, 'audio/ogg')).rejects.toMatchObject({
      code: 'UNCONFIGURED',
    });
    expect(new SttError('TIMEOUT', 'x').code).toBe('TIMEOUT');
  });
});
