import { NextResponse } from "next/server";
import { dbAcharya, dbConfigured } from "@/lib/server/supabase";
import { memoCache, CONTENT_CACHE_HEADERS } from "@/lib/server/cache";

export const runtime = "nodejs";
export const preferredRegion = "bom1";

export async function GET() {
  if (!dbConfigured) {
    return NextResponse.json({ modules: [] }, { headers: CONTENT_CACHE_HEADERS });
  }

  const modules = await memoCache("electrician:modules", 60, async () => {
    const { data, error } = await dbAcharya
      .from("modules")
      .select(`
        id, title_bn, title_hi, title_en, icon, theory_hours, practical_hours,
        sort_order, group_key, group_label_bn, group_label_hi, group_label_en
      `)
      .order("sort_order", { ascending: true });
    if (error) throw error;
    return data || [];
  }).catch((err) => {
    console.error("modules error:", err);
    return null;
  });

  if (modules === null) {
    return NextResponse.json({ error: "Failed to load modules" }, { status: 502 });
  }

  return NextResponse.json({ modules }, { headers: CONTENT_CACHE_HEADERS });
}


