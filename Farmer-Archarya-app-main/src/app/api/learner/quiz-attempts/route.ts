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

  const { moduleId, score, total, questions } = body as {
    moduleId?: string;
    score?: number;
    total?: number;
    questions?: unknown[];
  };

  if (!moduleId || typeof moduleId !== "string" || moduleId.length > 120) return NextResponse.json({ error: "Invalid moduleId" }, { status: 400 });
  if (typeof score !== "number" || !Number.isFinite(score) || score < 0 || score > 100 || typeof total !== "number" || !Number.isFinite(total) || total < 1 || total > 100) {
    return NextResponse.json({ error: "Invalid score/total" }, { status: 400 });
  }
  if (!Array.isArray(questions) || questions.length > 100) return NextResponse.json({ error: "Invalid questions" }, { status: 400 });

  const { data: mod } = await db.from("farmer_modules").select("id").eq("slug", moduleId).eq("is_deleted", false).maybeSingle();
  const { error } = await db.from("farmer_quiz_attempts").insert({
    learner_id: session.learnerId,
    module_id: mod ? mod.id : null,
    score,
    total,
    questions,
  });

  if (error) {
    console.error("quiz attempt error:", error);
    return NextResponse.json({ error: "Write failed" }, { status: 502 });
  }
  return NextResponse.json({ ok: true });
}

