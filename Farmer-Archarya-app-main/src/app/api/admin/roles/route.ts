import { NextRequest, NextResponse } from "next/server";
import { db, dbConfigured } from "@/lib/server/supabase";
import { hashAdminPassword, requireAdmin } from "@/lib/server/auth";

export async function GET() {
  const guard = await requireAdmin();
  if (guard instanceof NextResponse) return guard;
  if (!dbConfigured) return NextResponse.json({ accounts: [], users: [] });

  const [{ data: accounts, error: aErr }, { data: users, error: uErr }] = await Promise.all([
    db
      .from("farmer_admin_accounts")
      .select("id,email,role,is_active,last_login_at,created_at")
      .order("created_at", { ascending: false }),
    db
      .from("farmer_users")
      .select("id,phone,name,role,is_admin,is_active,preferred_lang,last_seen_on")
      .order("last_seen_on", { ascending: false }),
  ]);

  if (aErr || uErr) {
    return NextResponse.json({ error: "Failed to load roles" }, { status: 502 });
  }

  return NextResponse.json({ accounts: accounts || [], users: users || [] });
}

export async function POST(req: NextRequest) {
  const guard = await requireAdmin();
  if (guard instanceof NextResponse) return guard;
  if (!dbConfigured) return NextResponse.json({ ok: true });

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const action = String((body as { action?: unknown }).action || "");

  if (action === "upsertAccount") {
    const email = String((body as { email?: unknown }).email || "").trim().toLowerCase();
    const password = String((body as { password?: unknown }).password || "");
    const roleRaw = String((body as { role?: unknown }).role || "admin");
    const role = roleRaw === "founder" || roleRaw === "editor" ? roleRaw : "admin";
    const isActive = Boolean((body as { isActive?: unknown }).isActive ?? true);

    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      return NextResponse.json({ error: "Invalid email" }, { status: 400 });
    }
    if (password && password.length < 8) {
      return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });
    }

    const patch: Record<string, unknown> = {
      email,
      role,
      is_active: isActive,
      updated_at: new Date().toISOString(),
    };
    if (password) patch.password_hash = hashAdminPassword(password);

    const { error } = await db
      .from("farmer_admin_accounts")
      .upsert(patch, { onConflict: "email" });
    if (error) return NextResponse.json({ error: "Write failed" }, { status: 502 });
    return NextResponse.json({ ok: true });
  }

  if (action === "updateUserRole") {
    const userId = String((body as { userId?: unknown }).userId || "");
    const roleRaw = String((body as { role?: unknown }).role || "learner");
    const role = roleRaw === "founder" || roleRaw === "admin" ? roleRaw : "learner";
    if (!userId || userId.length > 80) return NextResponse.json({ error: "Invalid user" }, { status: 400 });

    const { error } = await db
      .from("farmer_users")
      .update({
        role,
        is_admin: role === "admin" || role === "founder",
        updated_at: new Date().toISOString(),
      })
      .eq("id", userId);
    if (error) return NextResponse.json({ error: "Write failed" }, { status: 502 });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}
