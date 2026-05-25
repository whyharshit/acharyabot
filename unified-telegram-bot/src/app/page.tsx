import { TELEGRAM_API_BASE } from "@/lib/urls";

export default function Home() {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const appUrl = process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const maskedToken = botToken ? `${botToken.slice(0, 6)}...${botToken.slice(-4)}` : "{TOKEN}";

  return (
    <div style={{ fontFamily: "system-ui, sans-serif", padding: "2rem", maxWidth: 600, margin: "0 auto" }}>
      <h1>Unified Acharya Telegram Bot</h1>
      <p>This is the unified Telegram bot for Farmer Acharya, Vajra Acharya, and Taksha Acharya.</p>
      <h2>Status</h2>
      <p>Webhook endpoint: <code>/api/telegram</code></p>
      <h2>Setup</h2>
      <p>Set the webhook URL (values are pulled from your env):</p>
      <pre>curl {TELEGRAM_API_BASE}/bot{maskedToken}/setWebhook?url={appUrl}/api/telegram</pre>
      <h2>Commands</h2>
      <ul>
        <li><code>/start</code> - Choose your Acharya and begin</li>
        <li><code>/login</code> - Login with phone number</li>
      </ul>
    </div>
  );
}
