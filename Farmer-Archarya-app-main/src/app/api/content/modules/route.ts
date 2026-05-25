import { NextResponse } from "next/server";
import { db, dbConfigured } from "@/lib/server/supabase";
import { memoCache, CONTENT_CACHE_HEADERS } from "@/lib/server/cache";

export const runtime = "nodejs";
export const preferredRegion = "bom1";

/**
 * GET /api/content/modules?lang=bn
 *
 * Returns this Acharya's module list in the requested language, falling back
 * to the English translation when a language row isn't present yet. Shape is
 * kept backwards-compatible with the old arjun_modules payload so the client
 * keeps working: { id, title_bn, title_hi, title_en, icon, sort_order, … }.
 * (The 'id' field stays as the module SLUG so existing client routing and
 * keying on M01-north-star continues to work.)
 */
export async function GET(req: Request) {
  if (!dbConfigured) {
    return NextResponse.json({ modules: [] }, { headers: CONTENT_CACHE_HEADERS });
  }

  const url = new URL(req.url);
  const lang = url.searchParams.get("lang") || "bn";
  if (!["bn", "hi", "en"].includes(lang)) {
    return NextResponse.json({ error: "Invalid lang" }, { status: 400 });
  }

  const modules = await memoCache(`acharya:modules`, 60, async () => {
    const { data, error } = await db
      .from("farmer_modules")
      .select(`
        id, slug, sort_order, theory_hours, practical_hours,
        icon, group_key, group_label_en, group_label_bn, group_label_hi,
        title_en, title_bn, title_hi, status
      `)
      .eq("is_deleted", false)
      .eq("status", "published")
      .order("sort_order");
    if (error) throw error;

    return (data || []).map((m) => {
      return {
        id: m.slug,
        title_en: m.title_en || "",
        title_bn: m.title_bn || m.title_en || "",
        title_hi: m.title_hi || m.title_en || "",
        icon: m.icon,
        sort_order: m.sort_order,
        theory_hours: m.theory_hours,
        practical_hours: m.practical_hours,
        group_key: m.group_key,
        group_label_en: m.group_label_en,
        group_label_bn: m.group_label_bn,
        group_label_hi: m.group_label_hi,
        status: m.status,
      };
    });
  }).catch((err) => {
    console.error("acharya modules error:", err);
    return null;
  });

  if (modules === null) {
    return NextResponse.json({ error: "Failed to load modules" }, { status: 502 });
  }
  return NextResponse.json({ modules }, { headers: CONTENT_CACHE_HEADERS });
}
