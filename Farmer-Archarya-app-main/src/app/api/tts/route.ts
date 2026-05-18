import { NextRequest, NextResponse } from 'next/server';
import { rateLimit, rateLimitKey } from '@/lib/rate-limit';
import { logTtsCall } from '@/lib/server/ai-logger';

export const runtime = 'nodejs';
export const preferredRegion = 'bom1';
export const maxDuration = 20;

const TTS_MODEL = 'google-tts-chirp3-hd';
const GEMINI_TTS_MODEL = 'gemini-2.5-flash-preview-tts';

function googleTtsErrorMessage(status: number, body: string) {
  if (status === 403 && /SERVICE_DISABLED|disabled|has not been used/i.test(body)) {
    return 'Google Cloud Text-to-Speech API is disabled for this API key project. Enable Cloud Text-to-Speech API in Google Cloud Console, wait a few minutes, then retry.';
  }
  if (status === 403 && /API key not valid|PERMISSION_DENIED|forbidden/i.test(body)) {
    return 'Google TTS key is not allowed to call Cloud Text-to-Speech. Check API restrictions, billing, and project access.';
  }
  if (status === 429 || /quota/i.test(body)) {
    return 'Google TTS quota or billing limit reached. Check quota and billing in Google Cloud Console.';
  }
  return 'Voice synthesis failed';
}

// --- In-memory MP3 cache -------------------------------------------------
// Keyed by hash(lang + cleanText). 1-hour TTL. ~200 entries cap so a long
// session can't balloon the function memory. On Vercel, each warm instance
// keeps its own copy — that's still a big win because the streaming Ask flow
// calls TTS per-sentence and sentences like "ভালো প্রশ্ন!" repeat constantly
// across learners and modules.
const MAX_CACHE_ENTRIES = 200;
const CACHE_TTL_MS = 60 * 60 * 1000;

interface CachedAudio {
  buffer: Buffer;
  expires: number;
  contentType: string;
}
const audioCache = new Map<string, CachedAudio>();

function hasRealSecret(value: string | undefined): value is string {
  if (!value) return false;
  const normalized = value.trim().toLowerCase();
  return (
    normalized.length > 12 &&
    !normalized.includes('your-') &&
    !normalized.includes('placeholder') &&
    !normalized.includes('replace-me')
  );
}

function wavFromPcm(pcm: Buffer, sampleRate = 24000, channels = 1, bitsPerSample = 16) {
  const header = Buffer.alloc(44);
  const byteRate = sampleRate * channels * bitsPerSample / 8;
  const blockAlign = channels * bitsPerSample / 8;

  header.write('RIFF', 0);
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(channels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitsPerSample, 34);
  header.write('data', 36);
  header.writeUInt32LE(pcm.length, 40);

  return Buffer.concat([header, pcm]);
}

async function synthesizeWithGemini(cleanText: string, langKey: string, signal: AbortSignal) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!hasRealSecret(apiKey)) return null;

  const style = langKey === 'hi'
    ? 'Say clearly in Hindi with a calm Indian farming mentor voice: '
    : langKey === 'bn'
    ? 'Say clearly in Bengali with a calm Indian farming mentor voice: '
    : 'Say clearly in Indian English with a calm farming mentor voice: ';

  const r = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_TTS_MODEL}:generateContent`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey,
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: style + cleanText }] }],
        generationConfig: {
          responseModalities: ['AUDIO'],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: 'Kore' },
            },
          },
        },
      }),
      signal,
    }
  );

  if (!r.ok) {
    const detail = await r.text().catch(() => '');
    console.warn(`[tts] Gemini fallback failed ${r.status}: ${detail.slice(0, 220)}`);
    return null;
  }

  const data = await r.json();
  const inline =
    data?.candidates?.[0]?.content?.parts?.[0]?.inlineData ??
    data?.candidates?.[0]?.content?.parts?.[0]?.inline_data;
  const audio = inline?.data;
  if (typeof audio !== 'string') return null;

  return wavFromPcm(Buffer.from(audio, 'base64'));
}

function hashKey(lang: string, text: string): string {
  let h = 0xdeadbeef;
  const s = lang + '|' + text;
  for (let i = 0; i < s.length; i++) {
    h = Math.imul(h ^ s.charCodeAt(i), 0x5bd1e995);
    h ^= h >>> 13;
  }
  return (h >>> 0).toString(36) + ':' + s.length.toString(36);
}

function pruneCache() {
  const now = Date.now();
  // First sweep expired entries.
  for (const [k, v] of audioCache) {
    if (v.expires <= now) audioCache.delete(k);
  }
  // Then drop oldest insertion-order entries if still over cap.
  if (audioCache.size <= MAX_CACHE_ENTRIES) return;
  const overflow = audioCache.size - MAX_CACHE_ENTRIES;
  let i = 0;
  for (const k of audioCache.keys()) {
    if (i++ >= overflow) break;
    audioCache.delete(k);
  }
}

// Remembered "first voice that worked" per language. Avoids re-probing the
// Chirp3-HD → Wavenet → Standard chain on every request once we know which
// voice Google serves for this project.
const preferredVoiceByLang = new Map<string, { languageCode: string; name: string }>();

const voiceChain: Record<string, Array<{ languageCode: string; name: string }>> = {
  bn: [
    { languageCode: 'bn-IN', name: 'bn-IN-Chirp3-HD-Charon' },
    { languageCode: 'bn-IN', name: 'bn-IN-Wavenet-B' },
    { languageCode: 'bn-IN', name: 'bn-IN-Standard-B' },
  ],
  hi: [
    { languageCode: 'hi-IN', name: 'hi-IN-Chirp3-HD-Orus' },
    { languageCode: 'hi-IN', name: 'hi-IN-Wavenet-B' },
    { languageCode: 'hi-IN', name: 'hi-IN-Standard-B' },
  ],
  en: [
    { languageCode: 'en-IN', name: 'en-IN-Chirp3-HD-Orus' },
    { languageCode: 'en-IN', name: 'en-IN-Wavenet-B' },
    { languageCode: 'en-IN', name: 'en-IN-Standard-B' },
  ],
};

export async function POST(req: NextRequest) {
  const { text, lang, learnerId } = await req.json();

  // Higher per-minute cap than chat because the streaming flow fires one TTS
  // call per sentence — a single chat reply can legitimately need 6-8 TTS
  // calls within a few seconds.
  const key = rateLimitKey(req.headers, learnerId, 'tts');
  const rl = rateLimit(key, 60);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Too many requests. Please wait.', retryInSeconds: rl.resetInSeconds },
      { status: 429, headers: { 'Retry-After': String(rl.resetInSeconds) } }
    );
  }

  if (!text || typeof text !== 'string' || text.length > 5000) {
    return NextResponse.json({ error: 'Invalid text' }, { status: 400 });
  }

  const apiKey = process.env.GOOGLE_TTS_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'Voice service not configured' }, { status: 500 });
  }

  // Strip markdown, fix dashes for speech, remove emoji
  const cleanText = text
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/\n/g, '. ')
    .replace(/(\d+)\s*-\s*(\d+)/g, '$1 to $2')
    .replace(/\s+-\s+/g, ', ')
    .replace(/\s+—\s+/g, ', ')
    .replace(/[\u{1F600}-\u{1F64F}]/gu, '')
    .replace(/[\u{1F300}-\u{1F5FF}]/gu, '')
    .replace(/[\u{1F680}-\u{1F6FF}]/gu, '')
    .replace(/[\u{1F1E0}-\u{1F1FF}]/gu, '')
    .replace(/[\u{2600}-\u{26FF}]/gu, '')
    .replace(/[\u{2700}-\u{27BF}]/gu, '')
    .replace(/[\u{FE00}-\u{FE0F}]/gu, '')
    .replace(/[\u{200D}]/gu, '')
    .replace(/[\u{20E3}]/gu, '')
    .replace(/[\u{E0020}-\u{E007F}]/gu, '')
    .replace(/  +/g, ' ')
    .trim()
    .slice(0, 5000);

  if (!cleanText) {
    return NextResponse.json({ error: 'Empty text after cleaning' }, { status: 400 });
  }

  const langKey = String(lang || 'bn');
  const cacheKey = hashKey(langKey, cleanText);

  // Cache hit — return the cached MP3 instantly. Also set browser/edge
  // Cache-Control so repeat playback of the same sentence is ~0 ms.
  const cached = audioCache.get(cacheKey);
  if (cached && cached.expires > Date.now()) {
    logTtsCall({
      model: TTS_MODEL, status: 'ok', durationMs: 0,
      chars: 0, lang: langKey,
    });
    return new NextResponse(new Uint8Array(cached.buffer), {
      headers: {
        'Content-Type': cached.contentType,
        'Content-Length': cached.buffer.length.toString(),
        'Cache-Control': 'public, max-age=3600, immutable',
        'X-Cache': 'HIT',
      },
    });
  }

  // Try the remembered good voice first, then fall through to the static chain.
  const preferred = preferredVoiceByLang.get(langKey);
  const fallback = voiceChain[langKey] || voiceChain.bn;
  const candidates = preferred
    ? [preferred, ...fallback.filter((v) => v.name !== preferred.name)]
    : fallback;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);
  const started = Date.now();
  const charCount = cleanText.length;

  try {
    let response: Response | null = null;
    let usedVoice = candidates[0].name;
    let lastErrText = '';

    for (const voiceConfig of candidates) {
      const r = await fetch(
        `https://texttospeech.googleapis.com/v1/text:synthesize?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            input: { text: cleanText },
            voice: voiceConfig,
            audioConfig: { audioEncoding: 'MP3' },
          }),
          signal: controller.signal,
        }
      );
      if (r.ok) {
        response = r;
        usedVoice = voiceConfig.name;
        // Remember this voice for next time — skips the probe chain.
        preferredVoiceByLang.set(langKey, voiceConfig);
        break;
      }
      // Only fall through on voice-not-found errors; fail fast on auth/quota.
      lastErrText = await r.text();
      const voiceMissing = r.status === 400 && /voice|name/i.test(lastErrText);
      const unavailable = r.status === 404;
      if (!voiceMissing && !unavailable) {
        clearTimeout(timeoutId);
        logTtsCall({
          model: TTS_MODEL, status: 'error', durationMs: Date.now() - started,
          chars: charCount, lang: langKey, errorMessage: lastErrText.slice(0, 300),
        });
        console.error('Google TTS error:', r.status, lastErrText);
        const geminiAudio = await synthesizeWithGemini(cleanText, langKey, controller.signal);
        if (geminiAudio) {
          clearTimeout(timeoutId);
          logTtsCall({
            model: GEMINI_TTS_MODEL, status: 'ok', durationMs: Date.now() - started,
            chars: charCount, lang: langKey,
          });
          audioCache.set(cacheKey, { buffer: geminiAudio, expires: Date.now() + CACHE_TTL_MS, contentType: 'audio/wav' });
          pruneCache();
          return new NextResponse(new Uint8Array(geminiAudio), {
            headers: {
              'Content-Type': 'audio/wav',
              'Content-Length': geminiAudio.length.toString(),
              'Cache-Control': 'public, max-age=3600, immutable',
              'X-Cache': 'MISS',
              'X-TTS-Provider': 'gemini',
            },
          });
        }
        return NextResponse.json(
          { error: googleTtsErrorMessage(r.status, lastErrText) },
          { status: r.status === 403 ? 403 : 502 }
        );
      }
      // The remembered voice itself just failed — forget it so we don't retry
      // it first next time.
      if (preferredVoiceByLang.get(langKey)?.name === voiceConfig.name) {
        preferredVoiceByLang.delete(langKey);
      }
      console.warn(`[tts] ${voiceConfig.name} unavailable, trying next…`);
    }

    if (!response) {
      clearTimeout(timeoutId);
      logTtsCall({
        model: TTS_MODEL, status: 'error', durationMs: Date.now() - started,
        chars: charCount, lang: langKey, errorMessage: 'All voices failed: ' + lastErrText.slice(0, 200),
      });
      return NextResponse.json({ error: 'No voice available for this language' }, { status: 502 });
    }
    console.log(`[tts] ${langKey} → ${usedVoice} (${charCount} chars)`);

    const data = await response.json();
    clearTimeout(timeoutId);
    if (!data.audioContent) {
      logTtsCall({
        model: TTS_MODEL, status: 'error', durationMs: Date.now() - started,
        chars: charCount, lang: langKey, errorMessage: 'No audio returned',
      });
      return NextResponse.json({ error: 'No audio returned' }, { status: 502 });
    }

    logTtsCall({
      model: TTS_MODEL, status: 'ok', durationMs: Date.now() - started,
      chars: charCount, lang: langKey,
    });

    const audioBuffer = Buffer.from(data.audioContent, 'base64');

    // Store in the in-memory cache and prune if needed.
    audioCache.set(cacheKey, { buffer: audioBuffer, expires: Date.now() + CACHE_TTL_MS, contentType: 'audio/mpeg' });
    pruneCache();

    return new NextResponse(new Uint8Array(audioBuffer), {
      headers: {
        'Content-Type': 'audio/mpeg',
        'Content-Length': audioBuffer.length.toString(),
        'Cache-Control': 'public, max-age=3600, immutable',
        'X-Cache': 'MISS',
      },
    });
  } catch (err) {
    clearTimeout(timeoutId);
    const aborted = err instanceof Error && (err.name === 'AbortError' || /aborted|timeout/i.test(err.message));
    const errorMessage = err instanceof Error ? err.message : String(err);
    logTtsCall({
      model: TTS_MODEL, status: aborted ? 'timeout' : 'error',
      durationMs: Date.now() - started, chars: charCount, lang: langKey, errorMessage,
    });
    console.error('TTS error:', err);
    if (aborted) {
      return NextResponse.json({ error: 'Voice synthesis timed out.' }, { status: 504 });
    }
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
