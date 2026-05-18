import "server-only";

export interface SmsResult {
  sent: boolean;
  provider: "msg91" | "twilio" | "console";
  detail?: string;
}

function hasMsg91Config() {
  return !!process.env.MSG91_AUTH_KEY && !!process.env.MSG91_TEMPLATE_ID;
}

function hasTwilioConfig() {
  return !!process.env.TWILIO_ACCOUNT_SID && !!process.env.TWILIO_AUTH_TOKEN && !!process.env.TWILIO_FROM_PHONE;
}

export function smsConfigured(): boolean {
  return hasMsg91Config() || hasTwilioConfig();
}

export async function sendOtpSms(phone: string, otp: string): Promise<SmsResult> {
  if (hasMsg91Config()) return sendMsg91Otp(phone, otp);
  if (hasTwilioConfig()) return sendTwilioOtp(phone, otp);

  console.log(`[otp] ${phone} -> ${otp}`);
  return { sent: false, provider: "console", detail: "SMS provider not configured" };
}

async function sendMsg91Otp(phone: string, otp: string): Promise<SmsResult> {
  const authKey = process.env.MSG91_AUTH_KEY || "";
  const templateId = process.env.MSG91_TEMPLATE_ID || "";
  const senderId = process.env.MSG91_SENDER_ID || "VAJRAA";
  const mobile = phone.replace(/^\+/, "");

  const res = await fetch("https://control.msg91.com/api/v5/flow", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      authkey: authKey,
    },
    body: JSON.stringify({
      template_id: templateId,
      sender: senderId,
      mobiles: mobile,
      otp,
      var1: otp,
    }),
  });

  const raw = await res.text();
  if (!res.ok) {
    console.error("[sms] MSG91 failed:", raw.slice(0, 500));
    throw new Error("OTP SMS failed");
  }

  return { sent: true, provider: "msg91" };
}

async function sendTwilioOtp(phone: string, otp: string): Promise<SmsResult> {
  const sid = process.env.TWILIO_ACCOUNT_SID || "";
  const token = process.env.TWILIO_AUTH_TOKEN || "";
  const from = process.env.TWILIO_FROM_PHONE || "";
  const auth = Buffer.from(`${sid}:${token}`).toString("base64");

  const body = new URLSearchParams({
    To: phone,
    From: from,
    Body: `Your Vajra Acharya OTP is ${otp}. It expires in 10 minutes.`,
  });

  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });

  const raw = await res.text();
  if (!res.ok) {
    console.error("[sms] Twilio failed:", raw.slice(0, 500));
    throw new Error("OTP SMS failed");
  }

  return { sent: true, provider: "twilio" };
}
