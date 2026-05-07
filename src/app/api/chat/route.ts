import { NextRequest, NextResponse } from "next/server";
import { ARJUN_SYSTEM_PROMPT } from "@/lib/system-prompt";
import { rateLimit, rateLimitKey } from "@/lib/rate-limit";
import { logChatCall } from "@/lib/server/ai-logger";

export const runtime = "nodejs";
export const preferredRegion = "bom1";
export const maxDuration = 30;

const MODEL = "gemini-2.5-flash";
const MAX_IMAGE_BYTES = 4 * 1024 * 1024;

function imagePart(image: string) {
  const match = image.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
  if (!match) return null;
  return {
    inline_data: {
      mime_type: match[1],
      data: match[2],
    },
  };
}

function textFromGemini(json: unknown): string {
  const j = json as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  return j.candidates?.[0]?.content?.parts
    ?.map((p) => p.text || "")
    .join("")
    .trim() || "";
}

export async function POST(req: NextRequest) {
  const { message, history, moduleId, lang, image, learnerId } = await req.json();

  const key = rateLimitKey(req.headers, learnerId, "chat");
  const rl = rateLimit(key);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please wait.", retryInSeconds: rl.resetInSeconds },
      { status: 429, headers: { "Retry-After": String(rl.resetInSeconds) } }
    );
  }

  if (!message || typeof message !== "string" || message.length > 4000) {
    return NextResponse.json({ error: "Invalid message" }, { status: 400 });
  }
  if (image !== undefined && image !== null) {
    if (typeof image !== "string" || image.length > MAX_IMAGE_BYTES || !image.startsWith("data:image/")) {
      return NextResponse.json({ error: "Invalid image" }, { status: 400 });
    }
  }

  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "Gemini API key not configured" }, { status: 500 });
  }

  const langName = lang === "bn" ? "Bengali" : lang === "hi" ? "Hindi" : "English";
  const systemInstruction = `${ARJUN_SYSTEM_PROMPT}

The learner is currently studying module: ${moduleId || "general electrician training"}.
Respond in ${langName}.`;

  const contents: Array<{ role: "user" | "model"; parts: Array<{ text: string }> }> = [];
  if (Array.isArray(history)) {
    for (const h of history.slice(-8)) {
      if (
        h &&
        (h.role === "user" || h.role === "assistant") &&
        typeof h.content === "string" &&
        h.content.length <= 4000
      ) {
        contents.push({
          role: h.role === "assistant" ? "model" : "user",
          parts: [{ text: h.content }],
        });
      }
    }
  }

  const parts: Array<{ text: string } | ReturnType<typeof imagePart>> = [{ text: message }];
  if (image) {
    const part = imagePart(image);
    if (!part) return NextResponse.json({ error: "Invalid image format" }, { status: 400 });
    parts.push(part);
  }

  const started = Date.now();
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${encodeURIComponent(apiKey)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: systemInstruction }] },
          contents: [...contents, { role: "user", parts }],
          generationConfig: {
            temperature: 0.45,
            maxOutputTokens: 900,
          },
        }),
      }
    );

    const raw = await res.text();
    const json = raw ? JSON.parse(raw) : {};
    if (!res.ok) {
      console.error("Gemini chat error:", json);
      logChatCall({
        model: MODEL,
        status: "error",
        durationMs: Date.now() - started,
        lang,
        moduleId,
        hasImage: !!image,
        errorMessage: raw.slice(0, 500),
      });
      return NextResponse.json({ error: "Chat generation failed" }, { status: 502 });
    }

    const reply = textFromGemini(json);
    logChatCall({
      model: MODEL,
      status: "ok",
      durationMs: Date.now() - started,
      lang,
      moduleId,
      hasImage: !!image,
    });

    return new Response(reply || "I could not generate a reply. Please try again.", {
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    logChatCall({
      model: MODEL,
      status: "error",
      durationMs: Date.now() - started,
      lang,
      moduleId,
      hasImage: !!image,
      errorMessage,
    });
    console.error("Gemini chat threw:", err);
    return NextResponse.json({ error: "Chat generation failed" }, { status: 502 });
  }
}


