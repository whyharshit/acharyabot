import { NextResponse } from "next/server";
import { db, dbConfigured } from "@/lib/server/supabase";
import { requireAdmin } from "@/lib/server/auth";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const guard = await requireAdmin();
  if (guard instanceof NextResponse) return guard;

  if (!dbConfigured) return NextResponse.json({ module: null, sections: [] });

  const { id } = await ctx.params;
  if (!id || id.length > 80) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const { data: mod, error: mErr } = await db
    .from("farmer_modules")
    .select("*")
    .eq("id", id)
    .single();
  if (mErr || !mod) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { data: sections, error: sErr } = await db
    .from("farmer_sections")
    .select("*")
    .eq("module_id", id)
    .order("sort_order");
  if (sErr) {
    return NextResponse.json({ error: "Failed to load sections" }, { status: 502 });
  }

  const secs = sections || [];
  const sectionsWithContent = secs.map((s: { id: string; body_bn?: string; body_hi?: string; body_en?: string; [k: string]: unknown }) => ({
    ...s,
    content: {
      bn: s.body_bn ? { body: s.body_bn } : null,
      hi: s.body_hi ? { body: s.body_hi } : null,
      en: s.body_en ? { body: s.body_en } : null,
    },
  }));

  return NextResponse.json({ module: mod, sections: sectionsWithContent });
}

