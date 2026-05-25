import { NextRequest, NextResponse } from "next/server";
import { db, dbConfigured } from "@/lib/server/supabase";
import { memoCache, CONTENT_CACHE_HEADERS } from "@/lib/server/cache";

export const runtime = "nodejs";
export const preferredRegion = "bom1";

/**
 * GET /api/content/videos?moduleId=M15-video-library&limit=3
 * Use moduleId=all to return every published video.
 *
 * Returns videos for a module (by slug). Shape stays backwards-compatible
 * with the legacy arjun_videos response.
 */
export async function GET(req: NextRequest) {
  if (!dbConfigured) {
    return NextResponse.json({ videos: [] }, { headers: CONTENT_CACHE_HEADERS });
  }

  const url = new URL(req.url);
  const moduleSlug = url.searchParams.get("moduleId") || "M15-video-library";
  const limitParam = url.searchParams.get("limit");
  const limit = limitParam
    ? Math.max(1, Math.min(50, parseInt(limitParam, 10) || 0))
    : undefined;

  if (moduleSlug.length > 120) {
    return NextResponse.json({ error: "Invalid moduleId" }, { status: 400 });
  }

  const cacheKey = `acharya:videos:${moduleSlug}:${limit ?? "all"}`;
  const videos = await memoCache(cacheKey, 60, async () => {
    let moduleId: string | null = null;
    const moduleSlugById: Record<string, string> = {};

    if (moduleSlug !== "all") {
      const { data: mod } = await db
        .from("farmer_modules")
        .select("id")
        .eq("slug", moduleSlug)
        .eq("is_deleted", false)
        .maybeSingle();
      if (!mod) return [];
      moduleId = mod.id;
      moduleSlugById[mod.id] = moduleSlug;
    } else {
      const { data: modules } = await db
        .from("farmer_modules")
        .select("id, slug")
        .eq("is_deleted", false);
      for (const mod of modules || []) moduleSlugById[mod.id] = mod.slug;
    }

    let q = db
      .from("farmer_videos")
      .select(`
        id, module_id, youtube_id, start_seconds, duration, sort_order,
        title_en, title_bn, title_hi, status
      `)
      .eq("is_deleted", false)
      .eq("status", "published")
      .order("sort_order");
    if (moduleId) q = q.eq("module_id", moduleId);
    if (limit) q = q.limit(limit);

    const { data, error } = await q;
    if (error) throw error;

    return (data || []).map((v) => {
      return {
        id: v.id,
        youtube_id: v.youtube_id,
        module_id: moduleSlugById[v.module_id] || moduleSlug,
        title_en: v.title_en || "",
        title_bn: v.title_bn || v.title_en || "",
        title_hi: v.title_hi || v.title_en || "",
        duration: v.duration,
        start_seconds: v.start_seconds,
        sort_order: v.sort_order,
      };
    });
  }).catch((err) => {
    console.error("acharya videos error:", err);
    return null;
  });

  if (videos === null) {
    return NextResponse.json({ error: "Failed to load videos" }, { status: 502 });
  }
  return NextResponse.json({ videos }, { headers: CONTENT_CACHE_HEADERS });
}
