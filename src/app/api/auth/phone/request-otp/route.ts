import { NextRequest, NextResponse } from "next/server";
import { dbGunakul, dbConfigured } from "@/lib/server/supabase";
import { rateLimit, rateLimitKey } from "@/lib/rate-limit";
import { normalizeIndianPhone } from "@/lib/phone";

export const runtime = "nodejs";
export const preferredRegion = "bom1";

export async function POST(req: NextRequest) {
  const rl = rateLimit(rateLimitKey(req.headers, null, "otp-request"), 5);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Too many attempts. Please wait a minute.", retryInSeconds: rl.resetInSeconds },
      { status: 429, headers: { "Retry-After": String(rl.resetInSeconds) } }
    );
  }

  if (!dbConfigured) {
    return NextResponse.json({ error: "Service not configured" }, { status: 500 });
  }

  const body = await req.json().catch(() => null);
  const phone = normalizeIndianPhone(String((body as { phone?: string } | null)?.phone || ""));
  if (!phone) {
    return NextResponse.json(
      { error: "Enter a valid 10-digit Indian mobile number." },
      { status: 400 }
    );
  }

  const { error } = await dbGunakul
    .from("learners")
    .upsert(
      { phone, name: `Learner ${phone.slice(-4)}`, role: "learner", is_active: true },
      { onConflict: "phone" }
    );

  if (error) {
    console.error("otp-request learner upsert error:", error);
    return NextResponse.json({ error: "Service error. Try again shortly." }, { status: 502 });
  }

  return NextResponse.json({ ok: true, phone });
}


