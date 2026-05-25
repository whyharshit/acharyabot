import { NextResponse } from "next/server";
import { clearLearnerCookie, getLearnerSession } from "@/lib/server/phone-auth";
import { dbGunakul, dbConfigured } from "@/lib/server/supabase";

export const runtime = "nodejs";
export const preferredRegion = "bom1";

export async function GET() {
  const s = await getLearnerSession();
  if (!s) return NextResponse.json({ learner: null });

  if (!dbConfigured) {
    return NextResponse.json({
      learner: { id: s.learnerId, phone: s.phone, name: s.name, role: s.roleSlug, isAdmin: s.isAdmin },
    });
  }

  const { data, error } = await dbGunakul
    .from("learners")
    .select("id, phone, name, role, preferred_lang, is_active")
    .eq("id", s.learnerId)
    .maybeSingle();

  if (error) {
    console.error("[auth/me] learner lookup error:", error);
    return NextResponse.json({
      learner: { id: s.learnerId, phone: s.phone, name: s.name, role: s.roleSlug, isAdmin: s.isAdmin },
    });
  }

  if (!data || data.is_active === false) {
    const res = NextResponse.json({ learner: null });
    clearLearnerCookie(res);
    return res;
  }

  const role = (data.role as string) || "learner";
  const isAdmin = role === "founder" || role === "admin";
  return NextResponse.json({
    learner: {
      id: data.id,
      phone: data.phone,
      name: data.name,
      role,
      isAdmin,
      preferredLang: data.preferred_lang || "en",
    },
  });
}


