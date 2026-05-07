import { NextRequest, NextResponse } from "next/server";
import { dbGunakul, dbConfigured } from "@/lib/server/supabase";
import { getLearnerSession } from "@/lib/server/phone-auth";

export const runtime = "nodejs";
export const preferredRegion = "bom1";

export async function POST(req: NextRequest) {
  if (!dbConfigured) return NextResponse.json({ learnerId: null });

  const session = await getLearnerSession();
  if (!session) return NextResponse.json({ learnerId: null });

  const body = await req.json().catch(() => null) as { lang?: string } | null;
  const preferredLang = body && ["bn", "hi", "en"].includes(body.lang || "")
    ? body.lang
    : undefined;

  const update: Record<string, unknown> = { last_seen_at: new Date().toISOString() };
  if (preferredLang) update.preferred_lang = preferredLang;

  const { error } = await dbGunakul.from("learners").update(update).eq("id", session.learnerId);
  if (error) console.error("learner init update failed:", error);

  return NextResponse.json({ learnerId: session.learnerId });
}


