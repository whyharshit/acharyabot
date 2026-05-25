export default function Home() {
  return (
    <div style={{ fontFamily: "system-ui, sans-serif", padding: "2rem", maxWidth: 600, margin: "0 auto" }}>
      <h1>Unified Acharya Telegram Bot</h1>
      <p>This is the unified Telegram bot for Farmer Acharya, Vajra Acharya, and Taksha Acharya.</p>
      <h2>Status</h2>
      <p>Webhook endpoint: <code>/api/telegram</code></p>
      <h2>Setup</h2>
      <p>Set the webhook URL:</p>
      <pre>curl https://api.telegram.org/bot{'{TOKEN}'}/setWebhook?url={'{APP_URL}'}/api/telegram</pre>
      <h2>Commands</h2>
      <ul>
        <li><code>/start</code> - Choose your Acharya and begin</li>
        <li><code>/login</code> - Login with phone number</li>
      </ul>
    </div>
  );
}
