import { NextResponse } from "next/server";
import { getSessionTableSQL } from "@/lib/server/supabase";

/**
 * Setup endpoint for the bot_sessions table.
 *
 * GET /api/setup-session
 *
 * Returns the SQL migration that needs to be run in the Supabase Dashboard
 * to create the bot_sessions table. This table is required for session
 * persistence (BUG-06 fix).
 */
export async function GET() {
  const sql = getSessionTableSQL();
  const projectUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const projectRef = projectUrl.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1] || "unknown";
  const dashboardUrl = `https://supabase.com/dashboard/project/${projectRef}/sql/new`;

  return NextResponse.json({
    message: "Run the following SQL in the Supabase Dashboard SQL Editor to create the bot_sessions table.",
    dashboardUrl,
    sql,
    instructions: [
      `1. Open ${dashboardUrl}`,
      "2. Paste the SQL below into the editor",
      "3. Click 'Run'",
      "4. The bot will automatically detect the new table",
    ],
  });
}
