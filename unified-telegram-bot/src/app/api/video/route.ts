import { NextResponse } from "next/server";

/**
 * BUG-01 fix: /api/video redirect route.
 *
 * The bot generates links like appLink(acharya, "/video") pointing to the
 * frontend apps. This fallback route redirects users who somehow land on the
 * bot's domain to the correct frontend video page.
 */

const APP_URLS: Record<string, string> = {
  farmer: process.env.FARMER_APP_URL || "https://farmer-acharya-app.vercel.app",
  vajra: process.env.VAJRA_APP_URL || "https://vajra-acharya.vercel.app",
  taksha: process.env.TAKSHA_APP_URL || "https://taksha-acharya.vercel.app",
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const acharya = searchParams.get("acharya") || "vajra";
  const baseUrl = APP_URLS[acharya] || APP_URLS.vajra;
  return NextResponse.redirect(`${baseUrl}/video`);
}
