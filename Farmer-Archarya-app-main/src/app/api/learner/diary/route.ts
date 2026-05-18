import { NextRequest, NextResponse } from "next/server";
import { db, dbConfigured } from "@/lib/server/supabase";
import { getLearnerSession } from "@/lib/server/phone-auth";

export const runtime = "nodejs";

export async function GET() {
  const session = await getLearnerSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!dbConfigured) return NextResponse.json({ entries: [] });

  const { data, error } = await db
    .from("farmer_diary_entries")
    .select("*")
    .eq("learner_id", session.learnerId)
    .order("entry_date", { ascending: false })
    .limit(50);

  if (error) return NextResponse.json({ error: "Failed to load diary" }, { status: 502 });
  return NextResponse.json({ entries: data || [] });
}

export async function POST(req: NextRequest) {
  const session = await getLearnerSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!dbConfigured) return NextResponse.json({ ok: true });

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  const crop = String((body as { crop?: unknown }).crop || "").slice(0, 120);
  const activity = String((body as { activity?: unknown }).activity || "").slice(0, 160);
  const notes = String((body as { notes?: unknown }).notes || "").slice(0, 1000);
  const expense = Number((body as { expense?: unknown }).expense || 0);
  const entryDate = String((body as { entryDate?: unknown }).entryDate || new Date().toISOString().slice(0, 10));

  if (!activity) return NextResponse.json({ error: "Activity is required" }, { status: 400 });

  const { error } = await db.from("farmer_diary_entries").insert({
    learner_id: session.learnerId,
    entry_date: entryDate,
    crop,
    activity,
    expense: Number.isFinite(expense) ? expense : 0,
    notes,
  });

  if (error) return NextResponse.json({ error: "Failed to save diary" }, { status: 502 });
  return NextResponse.json({ ok: true });
}
