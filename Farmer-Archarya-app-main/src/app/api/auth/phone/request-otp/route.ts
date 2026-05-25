import { NextRequest, NextResponse } from "next/server";
import { db, dbConfigured } from "@/lib/server/supabase";
import { rateLimit, rateLimitKey } from "@/lib/rate-limit";
import { normalizeIndianPhone } from "@/lib/phone";

export const runtime = "nodejs";
export const preferredRegion = "bom1";

const autoCreatePilotUsers =
  process.env.AUTO_CREATE_PILOT_USERS === "true" ||
  (process.env.NODE_ENV === "development" && process.env.AUTO_CREATE_PILOT_USERS !== "false");

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
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const phone = normalizeIndianPhone(String((body as { phone?: string }).phone || ""));
  if (!phone) {
    return NextResponse.json(
      { error: "Enter a valid 10-digit Indian mobile number." },
      { status: 400 }
    );
  }

  const { data, error } = await db
    .from("farmer_users")
    .select("id")
    .eq("phone", phone)
    .eq("is_active", true)
    .eq("is_deleted", false)
    .maybeSingle();

  if (error) {
    console.error("otp-request lookup error:", error);
    return NextResponse.json({ error: "Service error. Did you apply the Farmer database SQL?" }, { status: 502 });
  }

  if (!data) {
    if (!autoCreatePilotUsers) {
      return NextResponse.json(
        { error: "This number is not registered for the pilot. Ask your admin to add you." },
        { status: 404 }
      );
    }

    const { error: insertError } = await db.from("farmer_users").insert({
      phone,
      name: "Pilot Farmer",
      role: "learner",
      preferred_lang: "en",
      is_admin: false,
      last_seen_on: new Date().toISOString(),
    });
    if (insertError) {
      console.error("otp-request auto-create error:", insertError);
      return NextResponse.json({ error: "Could not create pilot user." }, { status: 502 });
    }
  }

  return NextResponse.json({ ok: true, phone });
}

