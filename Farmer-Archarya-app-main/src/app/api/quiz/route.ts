import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { rateLimit, rateLimitKey } from '@/lib/rate-limit';
import { logQuizCall } from '@/lib/server/ai-logger';
import { db, dbConfigured } from '@/lib/server/supabase';

export const runtime = 'nodejs';
export const preferredRegion = 'bom1';
export const maxDuration = 30;

const GEMINI_MODELS = ['gemini-2.5-flash', 'gemini-2.5-flash-lite', 'gemini-2.0-flash'] as const;

const QuizSchema = z.object({
  questions: z.array(
    z.object({
      q: z.string().min(1),
      options: z.array(z.string().min(1)).min(2).max(4),
      correct: z.number().int().min(0).max(3),
      explanation: z.string().min(1),
    })
  ).min(1).max(5),
});

type QuizQuestion = z.infer<typeof QuizSchema>['questions'][number];

function hasRealSecret(value: string | undefined): value is string {
  if (!value) return false;
  const normalized = value.trim().toLowerCase();
  return (
    normalized.length > 12 &&
    !normalized.includes('your-') &&
    !normalized.includes('placeholder') &&
    !normalized.includes('replace-me') &&
    !normalized.includes('changeme')
  );
}

function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function normalizeQuestion(q: QuizQuestion): QuizQuestion {
  const options = q.options.slice(0, 4);
  const correctText = options[q.correct] ?? options[0];
  const shuffledOptions = shuffle(options);
  return {
    q: q.q,
    options: shuffledOptions,
    correct: Math.max(0, shuffledOptions.indexOf(correctText)),
    explanation: q.explanation,
  };
}

function moduleTopic(moduleId: string): string {
  return moduleId.replace(/^M\d+-/, '').replace(/-/g, ' ').trim() || 'this module';
}

function fallbackPool(moduleId: string): QuizQuestion[] {
  const topic = moduleTopic(moduleId);
  return [
    {
      q: `What is the first step in ${topic}?`,
      options: ['Observe the field carefully', 'Spray immediately', 'Stop all water', 'Harvest at once'],
      correct: 0,
      explanation: 'Good observation helps choose the right action.',
    },
    {
      q: 'What should you check before applying advice?',
      options: ['Local field and weather', 'Only market price', 'Phone battery', 'Village name'],
      correct: 0,
      explanation: 'Farm advice works best when matched to local conditions.',
    },
    {
      q: 'Which habit helps control cost?',
      options: ['Keeping records', 'Buying by guesswork', 'Mixing all chemicals', 'Changing seed often'],
      correct: 0,
      explanation: 'Records show which inputs are giving value.',
    },
    {
      q: 'How should a new practice be tried first?',
      options: ['On a small plot', 'On the whole farm', 'After harvest', 'Without checking'],
      correct: 0,
      explanation: 'A small trial reduces risk.',
    },
    {
      q: 'Who can give reliable local guidance?',
      options: ['Agriculture officer or KVK', 'Only rumors', 'Only a shopkeeper', 'Nobody'],
      correct: 0,
      explanation: 'Local experts can adapt advice to your farm.',
    },
    {
      q: 'What is safer before using pesticide?',
      options: ['Read the label', 'Mix extra dose', 'Spray in strong wind', 'Skip protection'],
      correct: 0,
      explanation: 'The label gives crop, dose, safety, and waiting period.',
    },
    {
      q: 'When is soil-test advice most useful?',
      options: ['Before fertilizer planning', 'After crop loss', 'Only during harvest', 'After selling crop'],
      correct: 0,
      explanation: 'Soil tests help plan nutrients before spending money.',
    },
    {
      q: 'What helps compare mandi selling options?',
      options: ['Price and transport cost', 'Only distance', 'Only shop color', 'Only rumor'],
      correct: 0,
      explanation: 'Net return depends on price, quality, fees, and transport.',
    },
    {
      q: 'What should be recorded after field work?',
      options: ['Input, date, cost, result', 'Only crop name', 'Only phone number', 'Nothing'],
      correct: 0,
      explanation: 'Simple records make future decisions easier.',
    },
    {
      q: 'What reduces risk in irrigation decisions?',
      options: ['Checking soil moisture', 'Watering by habit', 'Waiting for wilting', 'Flooding daily'],
      correct: 0,
      explanation: 'Soil moisture shows whether the crop actually needs water.',
    },
    {
      q: 'What should you do when pest symptoms are unclear?',
      options: ['Scout more plants', 'Use strongest chemical', 'Ignore the crop', 'Burn all plants'],
      correct: 0,
      explanation: 'Scouting avoids wrong treatment and wasted money.',
    },
    {
      q: 'Why keep seed purchase details?',
      options: ['Trace variety and quality', 'Increase seed price', 'Avoid germination test', 'Replace soil test'],
      correct: 0,
      explanation: 'Seed records help track performance and complaints.',
    },
  ].map(normalizeQuestion);
}

function randomFallbackQuestions(moduleId: string): QuizQuestion[] {
  return shuffle(fallbackPool(moduleId)).slice(0, 5);
}

async function quizBankQuestions(moduleId: string, lang: string): Promise<QuizQuestion[] | null> {
  if (!dbConfigured) return null;

  const { data: mod, error: mErr } = await db
    .from('farmer_modules')
    .select('id')
    .eq('slug', moduleId)
    .eq('is_deleted', false)
    .maybeSingle();
  if (mErr || !mod) return null;

  const { data, error } = await db
    .from('farmer_quiz_bank')
    .select('question_en, question_hi, question_bn, options_en, options_hi, options_bn, correct_index, explanation_en, explanation_hi, explanation_bn')
    .eq('module_id', mod.id)
    .eq('status', 'published')
    .eq('is_deleted', false)
    .order('sort_order')
    .limit(50);
  if (error || !data || data.length < 1) return null;

  const questions = data.map((row) => {
    const q = lang === 'bn' ? row.question_bn : lang === 'hi' ? row.question_hi : row.question_en;
    const options = lang === 'bn' ? row.options_bn : lang === 'hi' ? row.options_hi : row.options_en;
    const explanation = lang === 'bn' ? row.explanation_bn : lang === 'hi' ? row.explanation_hi : row.explanation_en;
    const fallbackOptions = Array.isArray(row.options_en) ? row.options_en : [];
    return {
      q: q || row.question_en,
      options: Array.isArray(options) && options.length >= 2 ? options : fallbackOptions,
      correct: Number(row.correct_index) || 0,
      explanation: explanation || row.explanation_en || 'Review this point before trying again.',
    };
  }).filter((q): q is QuizQuestion => q.q && q.options.length >= 2 && q.correct >= 0 && q.correct < q.options.length);

  return shuffle(questions).slice(0, 5).map(normalizeQuestion);
}

async function quizBankQuestionsWithTimeout(moduleId: string, lang: string): Promise<QuizQuestion[] | null> {
  return Promise.race([
    quizBankQuestions(moduleId, lang),
    new Promise<null>((resolve) => setTimeout(() => resolve(null), 1500)),
  ]);
}

function jsonFromGeminiText(text: string): unknown {
  const cleaned = text
    .trim()
    .replace(/^```(?:json)?/i, '')
    .replace(/```$/i, '')
    .trim();
  return JSON.parse(cleaned);
}

async function geminiQuestions(moduleId: string, lang: string, completedIds: string[]): Promise<QuizQuestion[] | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!hasRealSecret(apiKey)) return null;

  const langInstruction =
    lang === 'bn'
      ? 'Write Bengali in Bengali script.'
      : lang === 'hi'
        ? 'Write Hindi in Devanagari script.'
        : 'Write simple English.';

  const prompt = `Create a random 5-question multiple-choice quiz for Indian farmers.
Module: ${moduleId}
Topic: ${moduleTopic(moduleId)}
Completed modules for optional cross-links: ${completedIds.join(', ') || 'none'}

Rules:
- ${langInstruction}
- Practical field knowledge only.
- Exactly 5 questions.
- Each question has 4 short options.
- correct is the zero-based index of the right option.
- Return ONLY valid JSON matching:
{"questions":[{"q":"...","options":["...","...","...","..."],"correct":0,"explanation":"..."}]}`;

  const body = JSON.stringify({
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: {
      maxOutputTokens: 1200,
      temperature: 0.95,
      responseMimeType: 'application/json',
    },
  });

  const started = Date.now();
  let lastDetail = '';
  let usedModel: string = GEMINI_MODELS[0];

  for (const model of GEMINI_MODELS) {
    usedModel = model;
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': apiKey,
        },
        body,
        signal: AbortSignal.timeout(12000),
      }
    );

    const raw = await res.text();
    if (!res.ok) {
      lastDetail = raw;
      if (res.status === 429 || res.status === 503) continue;
      break;
    }

    try {
      const data = JSON.parse(raw);
      const text = data?.candidates?.[0]?.content?.parts
        ?.map((part: { text?: unknown }) => (typeof part.text === 'string' ? part.text : ''))
        .join('');
      const parsed = QuizSchema.parse(jsonFromGeminiText(text || '{}'));
      logQuizCall({
        model: usedModel,
        status: 'ok',
        durationMs: Date.now() - started,
        usage: {
          inputTokens: data?.usageMetadata?.promptTokenCount,
          outputTokens: data?.usageMetadata?.candidatesTokenCount,
        },
        lang,
        moduleId,
      });
      return shuffle(parsed.questions).slice(0, 5).map(normalizeQuestion);
    } catch (err) {
      lastDetail = err instanceof Error ? err.message : String(err);
      break;
    }
  }

  logQuizCall({
    model: usedModel,
    status: 'error',
    durationMs: Date.now() - started,
    lang,
    moduleId,
    errorMessage: lastDetail.slice(0, 500),
  });
  return null;
}

export async function POST(req: NextRequest) {
  const { moduleId, lang = 'en', completedModuleIds, learnerId } = await req.json();

  const key = rateLimitKey(req.headers, learnerId, 'quiz');
  const rl = rateLimit(key);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Too many requests. Please wait.', retryInSeconds: rl.resetInSeconds },
      { status: 429, headers: { 'Retry-After': String(rl.resetInSeconds) } }
    );
  }

  if (!moduleId || typeof moduleId !== 'string' || moduleId.length > 80) {
    return NextResponse.json({ error: 'Invalid moduleId' }, { status: 400 });
  }
  if (!['bn', 'hi', 'en'].includes(lang)) {
    return NextResponse.json({ error: 'Invalid lang' }, { status: 400 });
  }

  const completedIds = Array.isArray(completedModuleIds)
    ? completedModuleIds
        .filter((x): x is string => typeof x === 'string' && x.length > 0 && x.length <= 80)
        .slice(0, 40)
    : [];

  const gemini = await geminiQuestions(moduleId, lang, completedIds).catch((err) => {
    console.error('Gemini quiz error:', err);
    return null;
  });
  if (gemini && gemini.length > 0) {
    return NextResponse.json({ questions: gemini, source: 'gemini' });
  }

  const bank = await quizBankQuestionsWithTimeout(moduleId, lang);
  if (bank && bank.length > 0) {
    return NextResponse.json({ questions: bank, source: 'quiz_bank' });
  }

  return NextResponse.json({ questions: randomFallbackQuestions(moduleId), source: 'fallback' });
}
