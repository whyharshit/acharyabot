import { NextResponse } from "next/server";
import { APP_URLS, VIDEO_PAGE_PATH } from "@/lib/urls";

/**
 * BUG-01 fix: /api/video redirect route.
 *
 * The bot generates links like appLink(acharya, "/video") pointing to the
 * frontend apps. This fallback route redirects users who somehow land on the
 * bot's domain to the correct frontend video page.
 */

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const acharya = searchParams.get("acharya") || "vajra";
  const baseUrl = APP_URLS[acharya as keyof typeof APP_URLS] || APP_URLS.vajra;
  return NextResponse.redirect(`${baseUrl}${VIDEO_PAGE_PATH}`);
}
