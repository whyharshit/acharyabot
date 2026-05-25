import { NextResponse } from "next/server";
import { db, dbConfigured } from "@/lib/server/supabase";
import { requireAdmin } from "@/lib/server/auth";

export async function GET() {
  const guard = await requireAdmin();
  if (guard instanceof NextResponse) return guard;

  if (!dbConfigured) return NextResponse.json({ modules: [] });

  const { data: mods, error } = await db
    .from("farmer_modules")
    .select("*")
    .order("sort_order");
  if (error) {
    return NextResponse.json({ error: "Failed to load modules" }, { status: 502 });
  }
  if (!mods) return NextResponse.json({ modules: [] });

  const [{ data: sections }] = await Promise.all([
    db.from("farmer_sections").select("module_id"),
  ]);

  const sectionCount: Record<string, number> = {};
  (sections || []).forEach((s: { module_id: string }) => {
    sectionCount[s.module_id] = (sectionCount[s.module_id] || 0) + 1;
  });

  const enriched = mods.map((m: { id: string; [k: string]: unknown }) => ({
    ...m,
    sectionCount: sectionCount[m.id] || 0,
    contentCount: sectionCount[m.id] || 0,
  }));

  return NextResponse.json({ modules: enriched });
}

