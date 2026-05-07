import { NextRequest, NextResponse } from "next/server";
import { dbGunakul, dbConfigured } from "@/lib/server/supabase";
import { rateLimit, rateLimitKey } from "@/lib/rate-limit";
import { normalizeIndianPhone } from "@/lib/phone";
import { DEV_OTP, setLearnerCookie } from "@/lib/server/phone-auth";

export const runtime = "nodejs";
export const preferredRegion = "bom1";

export async function POST(req: NextRequest) {
  const rl = rateLimit(rateLimitKey(req.headers, null, "otp-verify"), 10);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Too many attempts. Wait a minute.", retryInSeconds: rl.resetInSeconds },
      { status: 429, headers: { "Retry-After": String(rl.resetInSeconds) } }
    );
  }

  if (!dbConfigured) {
    return NextResponse.json({ error: "Service not configured" }, { status: 500 });
  }

  const body = await req.json().catch(() => null);
  const phone = normalizeIndianPhone(String((body as { phone?: string } | null)?.phone || ""));
  const otp = String((body as { otp?: string } | null)?.otp || "").replace(/\D/g, "");

  if (!phone) return NextResponse.json({ error: "Invalid phone number." }, { status: 400 });
  if (otp !== DEV_OTP) return NextResponse.json({ error: "Incorrect OTP. Try again." }, { status: 401 });

  const { data, error } = await dbGunakul
    .from("learners")
    .upsert(
      {
        phone,
        name: `Learner ${phone.slice(-4)}`,
        role: "learner",
        is_active: true,
        last_seen_at: new Date().toISOString(),
      },
      { onConflict: "phone" }
    )
    .select("id, phone, name, role, preferred_lang")
    .single();

  if (error || !data) {
    console.error("otp-verify learner upsert error:", error);
    return NextResponse.json({ error: "Service error. Try again shortly." }, { status: 502 });
  }

  const roleSlug = (data.role as string) || "learner";
  const isAdmin = roleSlug === "founder" || roleSlug === "admin";
  const session = {
    learnerId: data.id as string,
    phone: data.phone as string,
    name: (data.name as string) || "",
    roleSlug,
    categorySlug: "electrician",
    isAdmin,
  };

  const res = NextResponse.json({
    ok: true,
    learner: {
      id: session.learnerId,
      phone: session.phone,
      name: session.name,
      role: roleSlug,
      isAdmin,
      preferredLang: (data.preferred_lang as string) || "en",
    },
  });
  setLearnerCookie(res, session);
  return res;
}


