import { NextRequest, NextResponse } from "next/server";
import { dbAcharya, dbConfigured } from "@/lib/server/supabase";
import { memoCache, CONTENT_CACHE_HEADERS } from "@/lib/server/cache";

export const runtime = "nodejs";
export const preferredRegion = "bom1";

export async function GET(req: NextRequest) {
  if (!dbConfigured) {
    return NextResponse.json({ sections: [] }, { headers: CONTENT_CACHE_HEADERS });
  }

  const url = new URL(req.url);
  const moduleId = url.searchParams.get("moduleId");
  const lang = url.searchParams.get("lang") || "en";

  if (!moduleId || moduleId.length > 120) {
    return NextResponse.json({ error: "Invalid moduleId" }, { status: 400 });
  }
  if (!["bn", "hi", "en"].includes(lang)) {
    return NextResponse.json({ error: "Invalid lang" }, { status: 400 });
  }

  const sections = await memoCache(`electrician:sections:${moduleId}:${lang}`, 60, async () => {
    const { data, error } = await dbAcharya
      .from("sections")
      .select("id, module_id, title_bn, title_hi, title_en, sort_order, estimated_hours, body_bn, body_hi, body_en")
      .eq("module_id", moduleId)
      .order("sort_order", { ascending: true });
    if (error) throw error;

    return (data || []).map((s) => {
      const body = (s as Record<string, string | number | null>)[`body_${lang}`]
        || (s as { body_en?: string | null }).body_en
        || "";
      return {
        id: s.id,
        module_id: s.module_id,
        title_bn: s.title_bn,
        title_hi: s.title_hi,
        title_en: s.title_en,
        sort_order: s.sort_order,
        estimated_hours: s.estimated_hours,
        content: body ? { body } : null,
      };
    });
  }).catch((err) => {
    console.error("sections error:", err);
    return null;
  });

  if (sections === null) {
    return NextResponse.json({ error: "Failed to load sections" }, { status: 502 });
  }

  return NextResponse.json({ sections }, { headers: CONTENT_CACHE_HEADERS });
}


