require('dotenv').config({ path: '.env.local' });

// You can pass the URL as a command line argument, e.g., 
// node scripts/set-telegram-webhook.js https://your-app.vercel.app/api/telegram
const WEBHOOK_URL = process.argv[2];
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

if (!BOT_TOKEN) {
  console.error('❌ Error: TELEGRAM_BOT_TOKEN is not set in .env.local');
  process.exit(1);
}

if (!WEBHOOK_URL) {
  console.error('❌ Error: Please provide your public webhook URL.');
  console.log('Usage: node scripts/set-telegram-webhook.js https://your-app-url.com/api/telegram');
  console.log('If testing locally, use ngrok: node scripts/set-telegram-webhook.js https://<your-ngrok-id>.ngrok-free.app/api/telegram');
  process.exit(1);
}

async function setWebhook() {
  const url = `https://api.telegram.org/bot${BOT_TOKEN}/setWebhook`;
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: WEBHOOK_URL })
    });
    
    const data = await response.json();
    
    if (data.ok) {
      console.log(`✅ Webhook successfully set to: ${WEBHOOK_URL}`);
    } else {
      console.error('❌ Failed to set webhook:', data.description);
    }
  } catch (error) {
    console.error('❌ Error calling Telegram API:', error);
  }
}

setWebhook();
