import "server-only";
import crypto from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { db, dbConfigured } from "@/lib/server/supabase";

const COOKIE_NAME = "farmer-admin-session";
const MAX_AGE_SECONDS = 60 * 60 * 8; // 8 hours

const ADMIN_EMAIL = process.env.NEXT_PUBLIC_ADMIN_EMAIL || "admin@farmer-acharya.app";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "";
const SESSION_SECRET =
  process.env.SESSION_SECRET ||
  // Dev fallback — a deploy MUST set SESSION_SECRET, otherwise cookies are invalid across restarts.
  "farmer-dev-secret-change-me";

export function getAdminEmail(): string {
  return ADMIN_EMAIL;
}

/** Check credentials against env vars. Returns true on success. */
export function verifyAdminCredentials(email: string, password: string): boolean {
  if (!email || !password || !ADMIN_PASSWORD) return false;
  if (email.trim().toLowerCase() !== ADMIN_EMAIL.trim().toLowerCase()) return false;
  // constant-time compare
  const a = Buffer.from(password);
  const b = Buffer.from(ADMIN_PASSWORD);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

function sign(payload: string): string {
  return crypto.createHmac("sha256", SESSION_SECRET).update(payload).digest("base64url");
}

function createToken(email: string): string {
  // Encode the email as base64url so it can't contain the '.' separator.
  // Using encodeURIComponent was wrong because `.` isn't percent-encoded,
  // and any email like "user@example.com" produced a 4-piece token that
  // parseToken rejected.
  const emailEnc = Buffer.from(email, "utf8").toString("base64url");
  const exp = Math.floor(Date.now() / 1000) + MAX_AGE_SECONDS;
  const payload = `${emailEnc}.${exp}`;
  const sig = sign(payload);
  return `${payload}.${sig}`;
}

interface Session {
  email: string;
  exp: number;
}

export interface AdminAccount {
  email: string;
  role: "admin" | "founder" | "editor";
  source: "supabase" | "env";
}

function parseToken(token: string): Session | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [emailEnc, expStr, sig] = parts;
  const expected = sign(`${emailEnc}.${expStr}`);
  const sigBuf = Buffer.from(sig);
  const expBuf = Buffer.from(expected);
  if (sigBuf.length !== expBuf.length) return null;
  if (!crypto.timingSafeEqual(sigBuf, expBuf)) return null;
  const exp = parseInt(expStr, 10);
  if (!Number.isFinite(exp) || exp * 1000 < Date.now()) return null;
  let email: string;
  try {
    email = Buffer.from(emailEnc, "base64url").toString("utf8");
  } catch {
    return null;
  }
  return { email, exp };
}

export async function getAdminSession(): Promise<Session | null> {
  const store = await cookies();
  const c = store.get(COOKIE_NAME);
  if (!c) return null;
  const session = parseToken(c.value);
  if (!session) return null;
  const email = session.email.toLowerCase();
  if (email !== ADMIN_EMAIL.toLowerCase()) {
    if (!dbConfigured) return null;
    const { data } = await db
      .from("farmer_admin_accounts")
      .select("email,is_active")
      .eq("email", email)
      .eq("is_active", true)
      .maybeSingle();
    if (!data) return null;
  }
  return session;
}

export function hashAdminPassword(password: string): string {
  const iterations = 210000;
  const salt = crypto.randomBytes(16).toString("base64url");
  const hash = crypto.pbkdf2Sync(password, salt, iterations, 32, "sha256").toString("base64url");
  return `pbkdf2$${iterations}$${salt}$${hash}`;
}

function verifyPasswordHash(password: string, stored: string): boolean {
  const [algo, iterRaw, salt, hash] = stored.split("$");
  const iterations = Number(iterRaw);
  if (algo !== "pbkdf2" || !Number.isFinite(iterations) || !salt || !hash) return false;
  const candidate = crypto.pbkdf2Sync(password, salt, iterations, 32, "sha256").toString("base64url");
  const a = Buffer.from(candidate);
  const b = Buffer.from(hash);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

export async function verifyAdminLogin(email: string, password: string): Promise<AdminAccount | null> {
  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail || !password) return null;

  if (dbConfigured) {
    const { data, error } = await db
      .from("farmer_admin_accounts")
      .select("email,password_hash,role,is_active")
      .eq("email", normalizedEmail)
      .eq("is_active", true)
      .maybeSingle();

    if (!error && data?.password_hash && verifyPasswordHash(password, String(data.password_hash))) {
      const roleRaw = String(data.role || "admin");
      const role = roleRaw === "founder" || roleRaw === "editor" ? roleRaw : "admin";
      return { email: String(data.email), role, source: "supabase" };
    }
  }

  if (verifyAdminCredentials(normalizedEmail, password)) {
    return { email: getAdminEmail(), role: "founder", source: "env" };
  }

  return null;
}

export async function requireAdmin(): Promise<Session | NextResponse> {
  const s = await getAdminSession();
  if (!s) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return s;
}

export function setAdminCookie(res: NextResponse, email: string) {
  const token = createToken(email);
  res.cookies.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  });
}

export function clearAdminCookie(res: NextResponse) {
  res.cookies.set(COOKIE_NAME, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
}

export { COOKIE_NAME };
