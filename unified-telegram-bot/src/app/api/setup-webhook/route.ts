import { NextResponse } from "next/server";

export async function GET() {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const appUrl = process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  if (!botToken) {
    return NextResponse.json({ error: "TELEGRAM_BOT_TOKEN not set" }, { status: 500 });
  }

  const webhookUrl = `${appUrl}/api/telegram`;
  const secretToken = process.env.TELEGRAM_WEBHOOK_SECRET;
  const setWebhookUrl = new URL(`https://api.telegram.org/bot${botToken}/setWebhook`);

  setWebhookUrl.searchParams.set("url", webhookUrl);
  if (secretToken) setWebhookUrl.searchParams.set("secret_token", secretToken);

  try {
    const res = await fetch(setWebhookUrl.toString());
    const data = await res.json();
    return NextResponse.json({ webhookUrl, result: data });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
