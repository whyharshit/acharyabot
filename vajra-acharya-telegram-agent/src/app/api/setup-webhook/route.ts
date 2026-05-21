import { NextResponse } from "next/server";

export async function GET() {
  const token = process.env.TELEGRAM_BOT_TOKEN || "";
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET || "";
  const host = process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : process.env.NEXT_PUBLIC_APP_URL || "";

  if (!token) return NextResponse.json({ error: "TELEGRAM_BOT_TOKEN not set" }, { status: 500 });
  if (!host) return NextResponse.json({ error: "App URL unknown — set NEXT_PUBLIC_APP_URL env var" }, { status: 500 });

  const webhookUrl = `${host}/api/telegram/webhook`;
  const url = new URL(`https://api.telegram.org/bot${token}/setWebhook`);
  url.searchParams.set("url", webhookUrl);
  if (secret) url.searchParams.set("secret_token", secret);

  try {
    const res = await fetch(url.toString());
    const body = await res.json();
    return NextResponse.json({ ok: true, webhookUrl, telegram: body });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
