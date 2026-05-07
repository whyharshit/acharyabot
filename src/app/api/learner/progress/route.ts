import { NextRequest, NextResponse } from "next/server";
import { dbGunakul, dbConfigured } from "@/lib/server/supabase";
import { getLearnerSession } from "@/lib/server/phone-auth";

export const runtime = "nodejs";
export const preferredRegion = "bom1";

export async function POST(req: NextRequest) {
  if (!dbConfigured) return NextResponse.json({ ok: true });

  const session = await getLearnerSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const { moduleId, sectionsCompleted, completed } = (body || {}) as {
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

  const clean = sectionsCompleted.filter((id) => typeof id === "string" && id.length <= 200);
  const { error } = await dbGunakul
    .from("progress")
    .upsert(
      {
        learner_id: session.learnerId,
        module_id: moduleId,
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


