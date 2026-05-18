import { NextRequest, NextResponse } from "next/server";
import { db, dbConfigured } from "@/lib/server/supabase";
import { requireAdmin } from "@/lib/server/auth";

export async function GET() {
  const guard = await requireAdmin();
  if (guard instanceof NextResponse) return guard;
  if (!dbConfigured) return NextResponse.json({ questions: [], modules: [] });
  const [{ data: questions }, { data: modules }] = await Promise.all([
    db.from("farmer_quiz_bank").select("*").eq("is_deleted", false).order("sort_order"),
    db.from("farmer_modules").select("id,slug,title_en").eq("is_deleted", false).order("sort_order"),
  ]);
  return NextResponse.json({ questions: questions || [], modules: modules || [] });
}

export async function POST(req: NextRequest) {
  const guard = await requireAdmin();
  if (guard instanceof NextResponse) return guard;
  if (!dbConfigured) return NextResponse.json({ ok: true });
  const b = await req.json().catch(() => null) as Record<string, unknown> | null;
  if (!b) return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  const id = String(b.id || "");
  const options = String(b.optionsEn || "").split("\n").map((x) => x.trim()).filter(Boolean);
  const patch = {
    module_id: String(b.moduleId || ""),
    question_en: String(b.questionEn || "").trim(),
    question_hi: String(b.questionHi || "").trim(),
    question_bn: String(b.questionBn || "").trim(),
    options_en: options,
    options_hi: String(b.optionsHi || "").split("\n").map((x) => x.trim()).filter(Boolean),
    options_bn: String(b.optionsBn || "").split("\n").map((x) => x.trim()).filter(Boolean),
    correct_index: Math.max(0, Number(b.correctIndex || 0)),
    explanation_en: String(b.explanationEn || "").trim(),
    explanation_hi: String(b.explanationHi || "").trim(),
    explanation_bn: String(b.explanationBn || "").trim(),
    status: ["draft", "review", "published"].includes(String(b.status)) ? String(b.status) : "draft",
    updated_at: new Date().toISOString(),
  };
  if (!patch.module_id || !patch.question_en || options.length < 2) {
    return NextResponse.json({ error: "Module, question and at least two English options are required" }, { status: 400 });
  }
  const query = id
    ? db.from("farmer_quiz_bank").update(patch).eq("id", id)
    : db.from("farmer_quiz_bank").insert({ ...patch, sort_order: 999 });
  const { error } = await query;
  if (error) return NextResponse.json({ error: "Write failed" }, { status: 502 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const guard = await requireAdmin();
  if (guard instanceof NextResponse) return guard;
  if (!dbConfigured) return NextResponse.json({ ok: true });

  const id = new URL(req.url).searchParams.get("id") || "";
  if (!id || id.length > 80) {
    return NextResponse.json({ error: "Invalid question id" }, { status: 400 });
  }

  const { error } = await db
    .from("farmer_quiz_bank")
    .update({ is_deleted: true, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return NextResponse.json({ error: "Delete failed" }, { status: 502 });

  return NextResponse.json({ ok: true });
}
