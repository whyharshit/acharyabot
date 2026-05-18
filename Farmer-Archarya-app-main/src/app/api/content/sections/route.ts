import { NextRequest, NextResponse } from "next/server";
import { db, dbConfigured } from "@/lib/server/supabase";
import { memoCache, CONTENT_CACHE_HEADERS } from "@/lib/server/cache";

export const runtime = "nodejs";
export const preferredRegion = "bom1";

/**
 * GET /api/content/sections?moduleId=M01-north-star&lang=bn
 *
 * Resolves the module slug to a UUID, then returns sections + the
 * requested-language body. Shape backwards-compatible with the legacy
 * arjun_sections response: each section carries { id, title_*, content }.
 */
export async function GET(req: NextRequest) {
  if (!dbConfigured) {
    return NextResponse.json({ sections: [] }, { headers: CONTENT_CACHE_HEADERS });
  }

  const url = new URL(req.url);
  const moduleSlug = url.searchParams.get("moduleId");
  const lang = url.searchParams.get("lang") || "bn";

  if (!moduleSlug || moduleSlug.length > 120) {
    return NextResponse.json({ error: "Invalid moduleId" }, { status: 400 });
  }
  if (!["bn", "hi", "en"].includes(lang)) {
    return NextResponse.json({ error: "Invalid lang" }, { status: 400 });
  }

  const cacheKey = `acharya:sections:${moduleSlug}:${lang}`;
  const merged = await memoCache(cacheKey, 60, async () => {
    const { data: mod, error: mErr } = await db
      .from("farmer_modules")
      .select("id")
      .eq("slug", moduleSlug)
      .eq("is_deleted", false)
      .maybeSingle();
    if (mErr) throw mErr;
    if (!mod) return [];

    const { data: sections, error: sErr } = await db
      .from("farmer_sections")
      .select(`
        id, slug, sort_order, estimated_hours,
        title_en, title_bn, title_hi, body_en, body_bn, body_hi, status
      `)
      .eq("module_id", mod.id)
      .eq("is_deleted", false)
      .eq("status", "published")
      .order("sort_order");
    if (sErr) throw sErr;

    return (sections || []).map((s) => {
      const body = lang === "bn" ? (s.body_bn || s.body_en) : lang === "hi" ? (s.body_hi || s.body_en) : s.body_en;
      return {
        id: s.id,
        title_en: s.title_en || "",
        title_bn: s.title_bn || s.title_en || "",
        title_hi: s.title_hi || s.title_en || "",
        sort_order: s.sort_order,
        estimated_hours: s.estimated_hours,
        content: body ? { body } : null,
      };
    });
  }).catch((err) => {
    console.error("acharya sections error:", err);
    return null;
  });

  if (merged === null) {
    return NextResponse.json({ error: "Failed to load sections" }, { status: 502 });
  }
  return NextResponse.json({ sections: merged }, { headers: CONTENT_CACHE_HEADERS });
}
