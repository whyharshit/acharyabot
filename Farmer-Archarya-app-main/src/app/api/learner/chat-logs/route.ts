import { NextRequest, NextResponse } from "next/server";
import { db, dbConfigured } from "@/lib/server/supabase";
import { getLearnerSession } from "@/lib/server/phone-auth";

export const runtime = "nodejs";
export const preferredRegion = "bom1";

export async function POST(req: NextRequest) {
  if (!dbConfigured) return NextResponse.json({ ok: true });

  const session = await getLearnerSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  const { moduleId, lang, userMessage, aiResponse, responseTimeMs } = body as {
    moduleId?: string;
    lang?: string;
    userMessage?: string;
    aiResponse?: string;
    responseTimeMs?: number;
  };

  if (!["bn", "hi", "en"].includes(lang || "")) return NextResponse.json({ error: "Invalid lang" }, { status: 400 });
  if (typeof userMessage !== "string" || userMessage.length > 4000) return NextResponse.json({ error: "Invalid userMessage" }, { status: 400 });
  if (typeof aiResponse !== "string" || aiResponse.length > 8000) return NextResponse.json({ error: "Invalid aiResponse" }, { status: 400 });

  const rt = typeof responseTimeMs === "number" && Number.isFinite(responseTimeMs)
    ? Math.max(0, Math.min(120000, Math.round(responseTimeMs)))
    : null;

  let moduleUuid: string | null = null;
  if (moduleId && typeof moduleId === "string" && moduleId.length <= 120) {
    const { data: mod } = await db.from("farmer_modules").select("id").eq("slug", moduleId).eq("is_deleted", false).maybeSingle();
    if (mod) moduleUuid = mod.id as string;
  }

  const { error } = await db.from("farmer_chat_logs").insert({
    learner_id: session.learnerId,
    module_id: moduleUuid,
    lang,
    user_message: userMessage,
    ai_response: aiResponse,
    response_time_ms: rt,
  });

  if (error) {
    console.error("chat log error:", error);
    return NextResponse.json({ error: "Write failed" }, { status: 502 });
  }
  return NextResponse.json({ ok: true });
}

