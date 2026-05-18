import "server-only";
import { createClient } from "@supabase/supabase-js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DB = ReturnType<typeof createClient<any, any, any>>;

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const effectiveKey = serviceKey || anonKey;

const authOpts = { persistSession: false, autoRefreshToken: false } as const;

/**
 * Farmer Acharya uses one standalone Supabase project with public `farmer_*`
 * tables. The browser never imports Supabase; server routes use this client.
 */
export const db: DB = url && effectiveKey
  ? createClient(url, effectiveKey, { auth: authOpts })
  : createClient("https://placeholder.supabase.co", "placeholder", { auth: authOpts });

// Compatibility aliases for routes that still import the old names.
export const dbGunakul = db;
export const dbAcharya = db;

export const dbConfigured = !!url && !!effectiveKey
  && !url.includes("placeholder")
  && effectiveKey !== "placeholder";

export const ACHARYA_SLUG = process.env.NEXT_PUBLIC_ACHARYA_SLUG || "farmer";

export async function getAcharyaId(): Promise<string> {
  return ACHARYA_SLUG;
}

function roleOf(key: string): string | null {
  if (!key) return null;
  if (key.startsWith("sb_secret_")) return "service_role";
  if (key.startsWith("sb_publishable_")) return "anon";
  if (key.startsWith("eyJ")) {
    try {
      const payload = key.split(".")[1];
      if (!payload) return null;
      const b64 = payload.replace(/-/g, "+").replace(/_/g, "/");
      const padded = b64 + "=".repeat((4 - (b64.length % 4)) % 4);
      const json = JSON.parse(Buffer.from(padded, "base64").toString("utf8"));
      return typeof json.role === "string" ? json.role : null;
    } catch {
      return null;
    }
  }
  return null;
}

export const effectiveKeyRole = effectiveKey ? roleOf(effectiveKey) : null;
export const usingServiceRole = effectiveKeyRole === "service_role";

if (dbConfigured) {
  const host = (() => { try { return new URL(url).host; } catch { return url; } })();
  if (usingServiceRole) {
    console.log(`[farmer-db] service_role active (${host}), acharya=${ACHARYA_SLUG}`);
  } else {
    console.warn(`[farmer-db] service_role missing (${host}). Server writes may fail under RLS.`);
  }
}

