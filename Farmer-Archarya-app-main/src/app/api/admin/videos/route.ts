import { NextRequest, NextResponse } from "next/server";
import { db, dbConfigured } from "@/lib/server/supabase";
import { requireAdmin } from "@/lib/server/auth";
import { clearMemoCache } from "@/lib/server/cache";

function parseYouTube(input: string): { id: string; startSeconds: number | null } {
  const value = input.trim();
  if (!value) return { id: "", startSeconds: null };

  function parseTime(raw: string | null): number | null {
    if (!raw) return null;
    if (/^\d+$/.test(raw)) return Number(raw);
    const match = raw.match(/(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?/i);
    if (!match) return null;
    const hours = Number(match[1] || 0);
    const mins = Number(match[2] || 0);
    const secs = Number(match[3] || 0);
    const total = hours * 3600 + mins * 60 + secs;
    return total > 0 ? total : null;
  }

  try {
    const url = new URL(value);
    const host = url.hostname.replace(/^www\./, "");
    const startSeconds = parseTime(url.searchParams.get("t") || url.searchParams.get("start"));

    if (host === "youtu.be") {
      return { id: url.pathname.split("/").filter(Boolean)[0] || "", startSeconds };
    }
    if (host.endsWith("youtube.com")) {
      if (url.searchParams.get("v")) return { id: url.searchParams.get("v") || "", startSeconds };
      const parts = url.pathname.split("/").filter(Boolean);
      const marker = parts.findIndex((part) => ["embed", "shorts", "live"].includes(part));
      if (marker >= 0 && parts[marker + 1]) return { id: parts[marker + 1], startSeconds };
    }
  } catch {
    // Not a URL; treat it as a raw video id below.
  }

  const cleaned = value.replace(/[^a-zA-Z0-9_-]/g, "");
  return { id: cleaned, startSeconds: null };
}

export async function GET() {
  const guard = await requireAdmin();
  if (guard instanceof NextResponse) return guard;
  if (!dbConfigured) return NextResponse.json({ videos: [], modules: [] });

  const [{ data: videos }, { data: modules }] = await Promise.all([
    db.from("farmer_videos").select("*").eq("is_deleted", false).order("sort_order"),
    db.from("farmer_modules").select("id,slug,title_en").eq("is_deleted", false).order("sort_order"),
  ]);

  return NextResponse.json({ videos: videos || [], modules: modules || [] });
}

export async function POST(req: NextRequest) {
  const guard = await requireAdmin();
  if (guard instanceof NextResponse) return guard;
  if (!dbConfigured) return NextResponse.json({ ok: true });

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  const b = body as Record<string, unknown>;
  const id = String(b.id || "");
  const youtube = parseYouTube(String(b.youtubeId || ""));
  const patch = {
    module_id: String(b.moduleId || ""),
    youtube_id: youtube.id,
    start_seconds: youtube.startSeconds,
    title_en: String(b.titleEn || "").trim(),
    title_hi: String(b.titleHi || "").trim(),
    title_bn: String(b.titleBn || "").trim(),
    duration: String(b.duration || "").trim() || null,
    status: ["draft", "review", "published"].includes(String(b.status)) ? String(b.status) : "draft",
    updated_at: new Date().toISOString(),
  };
  if (!patch.module_id || !patch.youtube_id || !patch.title_en) {
    return NextResponse.json({ error: "Module, YouTube ID and English title are required" }, { status: 400 });
  }

  const query = id
    ? db.from("farmer_videos").update(patch).eq("id", id)
    : db.from("farmer_videos").insert({ ...patch, sort_order: 999 });
  const { error } = await query;
  if (error) return NextResponse.json({ error: "Write failed" }, { status: 502 });
  clearMemoCache("acharya:videos:");
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const guard = await requireAdmin();
  if (guard instanceof NextResponse) return guard;
  if (!dbConfigured) return NextResponse.json({ ok: true });

  const id = new URL(req.url).searchParams.get("id") || "";
  if (!id || id.length > 80) {
    return NextResponse.json({ error: "Invalid video id" }, { status: 400 });
  }

  const { error } = await db
    .from("farmer_videos")
    .update({ is_deleted: true, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return NextResponse.json({ error: "Delete failed" }, { status: 502 });

  clearMemoCache("acharya:videos:");
  return NextResponse.json({ ok: true });
}
