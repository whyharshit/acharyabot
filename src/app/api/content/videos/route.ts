import { NextRequest, NextResponse } from "next/server";
import { dbAcharya, dbConfigured } from "@/lib/server/supabase";
import { CONTENT_CACHE_HEADERS, memoCache } from "@/lib/server/cache";

export const runtime = "nodejs";
export const preferredRegion = "bom1";

export async function GET(req: NextRequest) {
  if (!dbConfigured) {
    return NextResponse.json({ videos: [] }, { headers: CONTENT_CACHE_HEADERS });
  }

  const url = new URL(req.url);
  const moduleId = url.searchParams.get("moduleId") || undefined;
  const limit = Math.min(20, Math.max(1, Number(url.searchParams.get("limit") || 20)));

  const videos = await memoCache(`electrician:videos:${moduleId || "all"}:${limit}`, 60, async () => {
    let q = dbAcharya
      .from("videos")
      .select("id, youtube_id, module_id, title_bn, title_hi, title_en, duration, start_seconds, sort_order")
      .order("sort_order", { ascending: true })
      .limit(limit);
    if (moduleId) q = q.eq("module_id", moduleId);
    const { data, error } = await q;
    if (error) throw error;
    return data || [];
  }).catch((err) => {
    console.error("videos error:", err);
    return [];
  });

  return NextResponse.json({ videos }, { headers: CONTENT_CACHE_HEADERS });
}


