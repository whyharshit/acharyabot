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

  const { moduleId, sectionsCompleted, completed } = body as {
    moduleId?: string;
    sectionsCompleted?: string[];
    completed?: boolean;
  };

  if (!moduleId || typeof moduleId !== "string" || moduleId.length > 120) {
    return NextResponse.json({ error: "Invalid moduleId" }, { status: 400 });
  }
  if (!Array.isArray(sectionsCompleted) || sectionsCompleted.length > 200) {
    return NextResponse.json({ error: "Invalid sectionsCompleted" }, { status: 400 });
  }

  const clean = sectionsCompleted.filter((id) => typeof id === "string" && id.length > 0 && id.length <= 200);
  const { data: mod, error: modErr } = await db
    .from("farmer_modules")
    .select("id")
    .eq("slug", moduleId)
    .eq("is_deleted", false)
    .maybeSingle();

  if (modErr || !mod) {
    console.error("progress: module slug not found:", moduleId, modErr);
    return NextResponse.json({ error: "Unknown module" }, { status: 404 });
  }

  const { error } = await db.from("farmer_progress").upsert(
    {
      learner_id: session.learnerId,
      module_id: mod.id,
      sections_completed: clean,
      completed: !!completed,
      completed_at: completed ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "learner_id,module_id" }
  );

  if (error) {
    console.error("progress upsert error:", error);
    return NextResponse.json({ error: "Write failed" }, { status: 502 });
  }
  return NextResponse.json({ ok: true });
}

