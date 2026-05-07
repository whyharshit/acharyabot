import { NextRequest, NextResponse } from "next/server";
import { ARJUN_SYSTEM_PROMPT } from "@/lib/system-prompt";
import { rateLimit, rateLimitKey } from "@/lib/rate-limit";
import { logQuizCall } from "@/lib/server/ai-logger";
import { memoCache } from "@/lib/server/cache";

export const runtime = "nodejs";
export const preferredRegion = "bom1";
export const maxDuration = 30;

const MODEL = "gemini-2.5-flash";

interface QuizQuestion {
  q: string;
  options: string[];
  correct: number;
  explanation: string;
}

function extractJson(text: string): unknown {
  const cleaned = text.trim().replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```$/i, "").trim();
  return JSON.parse(cleaned);
}

function normalizeQuestions(value: unknown): QuizQuestion[] {
  const obj = value as { questions?: unknown };
  const arr = Array.isArray(obj.questions) ? obj.questions : [];
  return arr.slice(0, 5).map((x) => {
    const q = x as Partial<QuizQuestion>;
    return {
      q: String(q.q || ""),
      options: Array.isArray(q.options) ? q.options.slice(0, 4).map(String) : [],
      correct: Number.isInteger(q.correct) ? q.correct as number : 0,
      explanation: String(q.explanation || ""),
    };
  }).filter((q) => q.q && q.options.length === 4 && q.correct >= 0 && q.correct <= 3);
}

export async function POST(req: NextRequest) {
  const { moduleId, lang, completedModuleIds, learnerId } = await req.json();

  const key = rateLimitKey(req.headers, learnerId, "quiz");
  const rl = rateLimit(key);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please wait.", retryInSeconds: rl.resetInSeconds },
      { status: 429, headers: { "Retry-After": String(rl.resetInSeconds) } }
    );
  }

  if (!moduleId || typeof moduleId !== "string" || moduleId.length > 120) {
    return NextResponse.json({ error: "Invalid moduleId" }, { status: 400 });
  }

  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "Gemini API key not configured" }, { status: 500 });
  }
  const geminiApiKey = apiKey;

  const langName = lang === "bn" ? "Bengali" : lang === "hi" ? "Hindi" : "English";
  const completedIds = Array.isArray(completedModuleIds)
    ? completedModuleIds.filter((x): x is string => typeof x === "string" && x.length <= 80).slice(0, 40)
    : [];

  const prompt = `${ARJUN_SYSTEM_PROMPT}

Generate exactly 5 multiple-choice quiz questions for Vajra Acharya module ${moduleId}.
Language: ${langName}.
Completed modules for context: ${completedIds.join(", ") || "none"}.

Return ONLY valid JSON in this exact shape:
{"questions":[{"q":"question","options":["A","B","C","D"],"correct":0,"explanation":"short explanation"}]}

Question topics should be practical electrician training: safety, tools, wiring, MCB/RCCB, earthing, load, fault finding, and customer service.`;

  const started = Date.now();

  async function runGeneration() {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${encodeURIComponent(geminiApiKey)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.35,
            maxOutputTokens: 1400,
            responseMimeType: "application/json",
          },
        }),
      }
    );

    const raw = await res.text();
    const json = raw ? JSON.parse(raw) : {};
    if (!res.ok) throw new Error(raw.slice(0, 500));
    const text = (json as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> })
      .candidates?.[0]?.content?.parts?.map((p) => p.text || "").join("") || "";
    const questions = normalizeQuestions(extractJson(text));
    if (questions.length !== 5) throw new Error("Gemini returned invalid quiz JSON");
    return questions;
  }

  try {
    const cacheable = completedIds.length === 0;
    const questions = cacheable
      ? await memoCache(`quiz:${moduleId}:${lang}`, 15 * 60, runGeneration)
      : await runGeneration();

    logQuizCall({ model: MODEL, status: "ok", durationMs: Date.now() - started, lang, moduleId });
    return NextResponse.json({ questions });
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    logQuizCall({ model: MODEL, status: "error", durationMs: Date.now() - started, lang, moduleId, errorMessage });
    console.error("Gemini quiz error:", err);
    return NextResponse.json({ error: "Quiz generation failed" }, { status: 502 });
  }
}


