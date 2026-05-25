import { NextRequest, NextResponse } from 'next/server';
import { streamText } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';
import type { ModelMessage } from 'ai';
import { FARMER_SYSTEM_PROMPT } from '@/lib/system-prompt';
import { rateLimit, rateLimitKey } from '@/lib/rate-limit';
import { logChatCall } from '@/lib/server/ai-logger';

export const runtime = 'nodejs';
export const preferredRegion = 'bom1';
export const maxDuration = 30;

const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
const MODEL = 'claude-4-sonnet-20250514';
const GEMINI_MODELS = ['gemini-2.5-flash', 'gemini-2.5-flash-lite', 'gemini-2.0-flash'] as const;

type ChatHistoryItem = {
  role?: unknown;
  content?: unknown;
};

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

function imageToGeminiPart(image: string) {
  const match = image.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
  if (!match) return null;
  return {
    inline_data: {
      mime_type: match[1],
      data: match[2],
    },
  };
}

async function geminiReply({
  message,
  history,
  moduleId,
  lang,
  image,
  systemSuffix,
}: {
  message: string;
  history: unknown;
  moduleId?: string;
  lang?: string;
  image?: string;
  systemSuffix: string;
}) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!hasRealSecret(apiKey)) {
    return NextResponse.json(
      { error: 'Chat service not configured. Add a real ANTHROPIC_API_KEY or GEMINI_API_KEY in .env.local.' },
      { status: 500 }
    );
  }

  const contents: Array<{ role: 'user' | 'model'; parts: Array<Record<string, unknown>> }> = [];
  if (Array.isArray(history)) {
    for (const h of history.slice(-10) as ChatHistoryItem[]) {
      if (
        (h.role === 'user' || h.role === 'assistant') &&
        typeof h.content === 'string' &&
        h.content.length <= 4000
      ) {
        contents.push({
          role: h.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: h.content }],
        });
      }
    }
  }

  const userParts: Array<Record<string, unknown>> = [{ text: message }];
  if (image) {
    const imagePart = imageToGeminiPart(image);
    if (!imagePart) {
      return NextResponse.json(
        { error: 'Gemini fallback supports uploaded image data URLs only.' },
        { status: 400 }
      );
    }
    userParts.push(imagePart);
  }
  contents.push({ role: 'user', parts: userParts });

  const body = JSON.stringify({
    systemInstruction: {
      parts: [{ text: `${FARMER_SYSTEM_PROMPT}\n\n${systemSuffix}` }],
    },
    contents,
    generationConfig: {
      maxOutputTokens: 900,
      temperature: 0.5,
    },
  });

  const started = Date.now();
  let res: Response | null = null;
  let usedModel: string = GEMINI_MODELS[0];
  let lastDetail = '';

  for (const candidate of GEMINI_MODELS) {
    usedModel = candidate;
    res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${candidate}:generateContent`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': apiKey,
        },
        body,
        signal: AbortSignal.timeout(25000),
      }
    );

    if (res.ok) break;

    lastDetail = await res.text().catch(() => '');
    const retryable = res.status === 429 || res.status === 503 || /high demand|unavailable|quota/i.test(lastDetail);
    console.warn(`[chat] ${candidate} failed ${res.status}: ${lastDetail.slice(0, 220)}`);
    if (!retryable) break;
  }

  if (!res?.ok) {
    logChatCall({
      model: usedModel,
      status: res?.status === 504 ? 'timeout' : 'error',
      durationMs: Date.now() - started,
      lang,
      moduleId,
      hasImage: !!image,
      errorMessage: lastDetail.slice(0, 500),
    });
    const overloaded = /high demand|unavailable/i.test(lastDetail);
    return NextResponse.json(
      { error: overloaded ? 'Gemini is busy right now. Please try again in a minute.' : 'Gemini chat request failed' },
      { status: overloaded ? 503 : 502 }
    );
  }

  const data = await res.json();
  const parts = data?.candidates?.[0]?.content?.parts;
  const text = Array.isArray(parts)
    ? parts.map((part) => (typeof part?.text === 'string' ? part.text : '')).join('')
    : '';

  logChatCall({
    model: usedModel,
    status: 'ok',
    durationMs: Date.now() - started,
    usage: {
      inputTokens: data?.usageMetadata?.promptTokenCount,
      outputTokens: data?.usageMetadata?.candidatesTokenCount,
    },
    lang,
    moduleId,
    hasImage: !!image,
  });

  return new Response(text || 'I could not generate a reply. Please try again.', {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
}

export async function POST(req: NextRequest) {
  const { message, history, moduleId, lang, image, learnerId } = await req.json();

  const key = rateLimitKey(req.headers, learnerId, 'chat');
  const rl = rateLimit(key);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Too many requests. Please wait.', retryInSeconds: rl.resetInSeconds },
      { status: 429, headers: { 'Retry-After': String(rl.resetInSeconds) } }
    );
  }

  if (!message || typeof message !== 'string' || message.length > 4000) {
    return NextResponse.json({ error: 'Invalid message' }, { status: 400 });
  }

  if (image !== undefined && image !== null) {
    if (typeof image !== 'string') {
      return NextResponse.json({ error: 'Invalid image' }, { status: 400 });
    }
    if (image.length > MAX_IMAGE_BYTES) {
      return NextResponse.json({ error: 'Image too large (max ~3MB)' }, { status: 413 });
    }
    if (!image.startsWith('data:image/') && !/^https?:\/\//.test(image)) {
      return NextResponse.json({ error: 'Invalid image format' }, { status: 400 });
    }
  }

  const langMap: Record<string, string> = {
    bn: 'Bengali (বাংলা লিপি)',
    hi: 'Hindi (हिन्दी)',
    en: 'English',
  };
  const langName = langMap[lang] || 'English';

  const scriptRule = lang === 'bn'
    ? `\n\nSCRIPT RULE (strict): Write the ENTIRE response in Bengali script. Farming loan words should be transliterated into Bengali script when natural. Do NOT mix Latin letters into Bengali sentences except URLs, email addresses, scientific Latin names, or unavoidable label text.`
    : lang === 'hi'
    ? `\n\nSCRIPT RULE (strict): Write the ENTIRE response in Devanagari script. Farming loan words should be transliterated into Devanagari when natural. Do NOT mix Latin letters into Hindi sentences except URLs, email addresses, scientific Latin names, or unavoidable label text.`
    : '';

  const systemSuffix = moduleId
    ? `\n\nThe user is currently studying module: ${moduleId}. Tailor your answers to this topic when relevant. Respond in ${langName}.${scriptRule}`
    : `\n\nRespond in ${langName}.${scriptRule}`;

  if (!hasRealSecret(process.env.ANTHROPIC_API_KEY)) {
    return geminiReply({ message, history, moduleId, lang, image, systemSuffix });
  }

  const messages: ModelMessage[] = [];
  if (Array.isArray(history)) {
    for (const h of history.slice(-10) as ChatHistoryItem[]) {
      if (
        (h.role === 'user' || h.role === 'assistant') &&
        typeof h.content === 'string' &&
        h.content.length <= 4000
      ) {
        messages.push({ role: h.role, content: h.content });
      }
    }
  }

  if (image) {
    messages.push({
      role: 'user',
      content: [
        { type: 'text', text: message },
        { type: 'image', image },
      ],
    });
  } else {
    messages.push({ role: 'user', content: message });
  }

  const started = Date.now();
  const abortSignal = AbortSignal.timeout(25000);

  const result = streamText({
    model: anthropic(MODEL),
    system: [
      {
        role: 'system',
        content: FARMER_SYSTEM_PROMPT,
        providerOptions: {
          anthropic: { cacheControl: { type: 'ephemeral' } },
        },
      },
      {
        role: 'system',
        content: systemSuffix,
      },
    ],
    messages,
    maxOutputTokens: 900,
    abortSignal,
    onFinish({ usage, providerMetadata }) {
      const u = usage as unknown as {
        inputTokens?: number;
        outputTokens?: number;
        cachedInputTokens?: number;
      } | undefined;
      const anthropicMeta = (providerMetadata as Record<string, unknown> | undefined)?.anthropic as
        | { cacheReadInputTokens?: number; cacheCreationInputTokens?: number }
        | undefined;
      const cachedInputTokens =
        u?.cachedInputTokens ?? anthropicMeta?.cacheReadInputTokens ?? 0;

      logChatCall({
        model: MODEL,
        status: 'ok',
        durationMs: Date.now() - started,
        usage: {
          inputTokens: u?.inputTokens,
          outputTokens: u?.outputTokens,
          cachedInputTokens,
        },
        lang,
        moduleId,
        hasImage: !!image,
      });
    },
    onError({ error }) {
      const aborted = error instanceof Error && (error.name === 'AbortError' || /aborted|timeout/i.test(error.message));
      const errorMessage = error instanceof Error ? error.message : String(error);
      logChatCall({
        model: MODEL,
        status: aborted ? 'timeout' : 'error',
        durationMs: Date.now() - started,
        lang,
        moduleId,
        hasImage: !!image,
        errorMessage,
      });
      console.error('Chat stream error:', error);
    },
  });

  return result.toTextStreamResponse();
}
