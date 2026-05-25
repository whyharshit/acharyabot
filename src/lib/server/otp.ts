import "server-only";
import crypto from "node:crypto";

const OTP_TTL_MINUTES = 10;
const OTP_LENGTH = 6;

const SECRET =
  process.env.OTP_SECRET ||
  process.env.SESSION_SECRET ||
  "vajra-acharya-dev-secret-change-me";

export function createOtp(): string {
  const max = 10 ** OTP_LENGTH;
  return String(crypto.randomInt(0, max)).padStart(OTP_LENGTH, "0");
}

export function hashOtp(phone: string, otp: string): string {
  return crypto
    .createHmac("sha256", SECRET)
    .update(`${phone}:${otp}`)
    .digest("hex");
}

export function otpExpiry(): string {
  return new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000).toISOString();
}

export function isOtpFormat(value: string): boolean {
  return /^\d{6}$/.test(value);
}

export { OTP_TTL_MINUTES };
