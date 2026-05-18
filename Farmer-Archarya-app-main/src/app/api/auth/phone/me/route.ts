import { NextResponse } from "next/server";
import {
  clearLearnerCookie,
  getLearnerSession,
} from "@/lib/server/phone-auth";
import { db, dbConfigured } from "@/lib/server/supabase";

export const runtime = "nodejs";
export const preferredRegion = "bom1";

/**
 * GET /api/auth/phone/me — current learner session, self-healing.
 *
 * Returns `{ learner: null }` in three situations, all of which also clear
 * the HttpOnly cookie so the browser stops sending it:
 *   1. No cookie present.
 *   2. Cookie fails HMAC or has expired.
 *   3. Cookie is valid but the user no longer exists / has been deactivated.
 *      (Happens after migrations that rebuild the users table, or when an
 *      admin deletes a user in the middle of an active session.)
 */
export async function GET() {
  const s = await getLearnerSession();
  if (!s) {
    return NextResponse.json({ learner: null });
  }

  // Cookie is well-formed. Now verify the user it points at is still live.
  if (!dbConfigured) {
    return NextResponse.json({
      learner: {
        id: s.learnerId,
        phone: s.phone,
        name: s.name,
        role: s.roleSlug,
        isAdmin: s.isAdmin,
      },
    });
  }

  const { data, error } = await db
    .from("farmer_users")
    .select("id")
    .eq("id", s.learnerId)
    .eq("is_deleted", false)
    .eq("is_active", true)
    .maybeSingle();

  if (error) {
    // DB hiccup — don't nuke the user's session over a transient error.
    console.error("[auth/me] learner lookup error:", error);
    return NextResponse.json({
      learner: {
        id: s.learnerId,
        phone: s.phone,
        name: s.name,
        role: s.roleSlug,
        isAdmin: s.isAdmin,
      },
    });
  }

  if (!data) {
    // User was deleted / deactivated / the cookie references a stale id
    // from a past schema. Evict the cookie so the client re-logs in.
    const res = NextResponse.json({ learner: null });
    clearLearnerCookie(res);
    return res;
  }

  return NextResponse.json({
    learner: {
      id: s.learnerId,
      phone: s.phone,
      name: s.name,
      role: s.roleSlug,
      isAdmin: s.isAdmin,
    },
  });
}
