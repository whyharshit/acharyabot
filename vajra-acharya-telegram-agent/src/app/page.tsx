import { dbConfigured } from "@/lib/server/supabase";

export default function Home() {
  return (
    <main style={{ fontFamily: "system-ui, sans-serif", maxWidth: 760, margin: "48px auto", padding: 24, lineHeight: 1.5 }}>
      <h1>Unified Acharya Telegram Bot</h1>
      <p>Multi-Acharya Telegram bot for Farmer Acharya, Vajra Acharya, and Taksha Acharya.</p>
      <dl>
        <dt>Webhook</dt>
        <dd><code>/api/telegram/webhook</code></dd>
        <dt>Supabase configured</dt>
        <dd><code>{String(dbConfigured)}</code></dd>
        <dt>Acharyas</dt>
        <dd>Farmer | Vajra | Taksha</dd>
      </dl>
      <h2>Setup</h2>
      <p>Set the webhook URL:</p>
      <pre>curl https://api.telegram.org/bot&#123;TOKEN&#125;/setWebhook?url=&#123;APP_URL&#125;/api/telegram/webhook</pre>
    </main>
  );
}
