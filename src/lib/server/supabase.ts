import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { AcharyaSlug } from "@/lib/system-prompts";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DB = ReturnType<typeof createClient<any, any, any>>;

export type Lang = "en" | "hi" | "bn";

// ── Acharya Table Config ────────────────────────────────────────────────────

export interface AcharyaTableConfig {
  users: string;
  modules: string;
  sections: string;
  videos: string;
  progress: string;
  quizAttempts: string;
  chatLogs: string;
  applyLogs: string;
  events: string | null;
  diary: string | null;
  aiUsage: string | null;
  // Telegram linking
  telegramTable: string | null; // separate table for telegram accounts (null = fields on users table)
  // Column names on the users table
  userCols: {
    phone: string;
    name: string;
    preferredLang: string;
    isActive: string;
    isDeleted: string | null;
    lastSeen: string;
    // Telegram fields on users table (when telegramTable is null)
    telegramUserId: string | null;
    telegramChatId: string | null;
    telegramUsername: string | null;
  };
  // FK column used in progress/quiz/chat/apply for learner reference
  learnerIdCol: string;
  // Module FK column in sections/videos
  moduleIdCol: string;
  // Which schema to use for content tables
  contentSchema?: string;
  // Which schema to use for log tables
  logSchema?: string;
  // Whether tables use is_deleted filter
  hasIsDeleted: boolean;
  // Whether tables have a status column
  hasStatus: boolean;
}

const FARMER_CONFIG: AcharyaTableConfig = {
  users: "farmer_users",
  modules: "farmer_modules",
  sections: "farmer_sections",
  videos: "farmer_videos",
  progress: "farmer_progress",
  quizAttempts: "farmer_quiz_attempts",
  chatLogs: "farmer_chat_logs",
  applyLogs: "farmer_apply_logs",
  events: "farmer_events",
  diary: "farmer_diary_entries",
  aiUsage: "farmer_ai_usage",
  telegramTable: null,
  userCols: {
    phone: "phone",
    name: "name",
    preferredLang: "preferred_lang",
    isActive: "is_active",
    isDeleted: "is_deleted",
    lastSeen: "last_seen_on",
    telegramUserId: "telegram_user_id",
    telegramChatId: "telegram_chat_id",
    telegramUsername: "telegram_username",
  },
  learnerIdCol: "learner_id",
  moduleIdCol: "module_id",
  hasIsDeleted: true,
  hasStatus: true,
};

const VAJRA_CONFIG: AcharyaTableConfig = {
  users: "learners",
  modules: "modules",
  sections: "sections",
  videos: "videos",
  progress: "progress",
  quizAttempts: "quiz_attempts",
  chatLogs: "chat_logs",
  applyLogs: "apply_logs",
  events: null,
  diary: null,
  aiUsage: "log_ai_usage",
  telegramTable: "telegram_accounts",
  userCols: {
    phone: "phone",
    name: "name",
    preferredLang: "preferred_lang",
    isActive: "is_active",
    isDeleted: null,
    lastSeen: "last_seen_at",
    telegramUserId: null,
    telegramChatId: null,
    telegramUsername: null,
  },
  learnerIdCol: "learner_id",
  moduleIdCol: "module_id",
  hasIsDeleted: false,
  hasStatus: false,
};

const TAKSHA_CONFIG: AcharyaTableConfig = {
  users: "mst_users",
  modules: "crs_modules",
  sections: "crs_sections",
  videos: "crs_videos",
  progress: "log_progress",
  quizAttempts: "log_quiz",
  chatLogs: "log_chat",
  applyLogs: "log_apply",
  events: null,
  diary: null,
  aiUsage: "log_ai_usage",
  telegramTable: "telegram_users",
  userCols: {
    phone: "phone",
    name: "name",
    preferredLang: "preferred_lang",
    isActive: "is_active",
    isDeleted: "is_deleted",
    lastSeen: "last_seen_on",
    telegramUserId: null,
    telegramChatId: null,
    telegramUsername: null,
  },
  learnerIdCol: "user_id",
  moduleIdCol: "module_id",
  contentSchema: "acharya_taksha",
  logSchema: "gunakul",
  hasIsDeleted: true,
  hasStatus: false,
};

export const ACHARYA_TABLE_CONFIG: Record<AcharyaSlug, AcharyaTableConfig> = {
  farmer: FARMER_CONFIG,
  vajra: VAJRA_CONFIG,
  taksha: TAKSHA_CONFIG,
};

// ── Per-Acharya Supabase Clients (BUG-04 fix) ──────────────────────────────
//
// Each Acharya has its own Supabase project. We create a separate client for
// each so queries hit the correct database.

const authOpts = { persistSession: false, autoRefreshToken: false } as const;

function makeClient(url: string, key: string): DB | null {
  if (!url || !key || url.includes("placeholder") || key === "placeholder") return null;
  return createClient(url, key, { auth: authOpts });
}

// Vajra (primary / shared)
const vajraUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const vajraKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const vajraDb = makeClient(vajraUrl, vajraKey);

// Farmer (separate project)
const farmerUrl = process.env.FARMER_SUPABASE_URL || "";
const farmerKey = process.env.FARMER_SUPABASE_SERVICE_ROLE_KEY || process.env.FARMER_SUPABASE_ANON_KEY || "";
const farmerDb = makeClient(farmerUrl, farmerKey);

// Taksha (separate project)
const takshaUrl = process.env.TAKSHA_SUPABASE_URL || "";
const takshaKey = process.env.TAKSHA_SUPABASE_SERVICE_ROLE_KEY || process.env.TAKSHA_SUPABASE_ANON_KEY || "";
const takshaDb = makeClient(takshaUrl, takshaKey);

// Placeholder for when no client is configured
const placeholderDb = createClient("https://placeholder.supabase.co", "placeholder", { auth: authOpts });

/** Get the Supabase client for a specific Acharya */
export function getDb(acharya: AcharyaSlug): DB {
  switch (acharya) {
    case "farmer": return farmerDb || placeholderDb;
    case "vajra": return vajraDb || placeholderDb;
    case "taksha": return takshaDb || placeholderDb;
  }
}

/** Get the shared / session database (Vajra's project) */
export function getSessionDb(): DB {
  return vajraDb || placeholderDb;
}

/** Backwards-compatible export (points to Vajra / shared) */
export const db: DB = vajraDb || placeholderDb;

/** Per-acharya configured check */
export function isDbConfigured(acharya: AcharyaSlug): boolean {
  switch (acharya) {
    case "farmer": return !!farmerDb;
    case "vajra": return !!vajraDb;
    case "taksha": return !!takshaDb;
  }
}

/** Legacy: true if at least the primary (Vajra) DB is configured */
export const dbConfigured = !!vajraDb;

// ── Acharya-aware query helpers ─────────────────────────────────────────────

function tableName(config: AcharyaTableConfig, key: keyof AcharyaTableConfig): string | null {
  const val = config[key];
  return typeof val === "string" ? val as string : null;
}

function maybeSchema(config: AcharyaTableConfig, schemaField: "contentSchema" | "logSchema"): string | undefined {
  return config[schemaField] || undefined;
}

/**
 * Get a typed Supabase query builder for a specific acharya's table.
 * Now uses the correct per-acharya DB client.
 */
export function acharyaTable(
  config: AcharyaTableConfig,
  table: Exclude<keyof AcharyaTableConfig, "userCols" | "learnerIdCol" | "moduleIdCol" | "hasIsDeleted" | "hasStatus" | "contentSchema" | "logSchema">,
  acharya?: AcharyaSlug,
) {
  const name = tableName(config, table);
  if (!name) return null;

  // Use the correct per-acharya client
  const client = acharya ? getDb(acharya) : db;

  // Determine schema: Farmer/Vajra use public, Taksha uses content/log schemas
  let schema: string | undefined;
  if (table === "modules" || table === "sections" || table === "videos") {
    schema = maybeSchema(config, "contentSchema");
  } else if (table === "users" || table === "progress" || table === "quizAttempts" || table === "chatLogs" || table === "applyLogs" || table === "aiUsage") {
    schema = maybeSchema(config, "logSchema");
  } else if (table === "telegramTable" || table === "events" || table === "diary") {
    schema = maybeSchema(config, "logSchema");
  }

  if (schema) {
    return client.schema(schema).from(name);
  }
  return client.from(name);
}

// ── User record types ───────────────────────────────────────────────────────

export interface TelegramLearner {
  id: string;
  phone: string;
  name: string | null;
  preferred_lang: Lang | null;
}

export interface TelegramAccount {
  id: string;
  learner_id: string | null;
  telegram_user_id: number;
  telegram_chat_id: number;
  preferred_lang: Lang;
}

// ── Module / Section / Video types (unified) ────────────────────────────────

export interface ModuleRow {
  id: string;
  slug?: string;
  title_en: string;
  title_hi?: string | null;
  title_bn?: string | null;
  sort_order?: number | null;
  // Farmer-specific
  theory_hours?: number | null;
  practical_hours?: number | null;
}

export interface SectionRow {
  id: string;
  module_id: string;
  title_en: string;
  title_hi?: string | null;
  title_bn?: string | null;
  body_en?: string | null;
  body_hi?: string | null;
  body_bn?: string | null;
  sort_order?: number | null;
}

export interface VideoRow {
  id: string;
  module_id: string;
  youtube_id: string;
  title_en: string;
  title_hi?: string | null;
  title_bn?: string | null;
  duration?: string | null;
  start_seconds?: number | null;
}

// ── Bot state types (in-memory) ─────────────────────────────────────────────

export type QuizQuestion = { q: string; options: string[]; correct: number; explanation: string };
export type QuizState = { moduleId: string; lang: Lang; questions: QuizQuestion[]; idx: number; score: number };
export type ToolState =
  | { kind: "weather" }
  | { kind: "mandi" }
  | { kind: "fertilizer" }
  | { kind: "diary"; step: "crop" | "activity" | "expense" | "notes"; crop?: string; activity?: string; expense?: number };
export type ApplyState = { turns: Array<{ text: string; hasPhoto?: boolean }>; moduleId?: string };
export type BotState = { quiz?: QuizState; tool?: ToolState; apply?: ApplyState; authenticatedPhone?: string; ask?: boolean };

// ── Session types (DB-backed, BUG-06 fix) ───────────────────────────────────

export interface BotSession {
  telegram_user_id: number;
  acharya_slug: AcharyaSlug | null;
  preferred_lang: Lang;
  learner_id: string | null;
  state_json: BotState;
  updated_at: string;
}

const SESSION_TABLE = "bot_sessions";

// Track whether the session table exists. Starts as unknown (null),
// becomes true/false after the first probe.
let sessionTableExists: boolean | null = null;

/**
 * Check if bot_sessions table exists by doing a lightweight probe.
 * Caches the result for the lifetime of this serverless instance.
 */
async function probeSessionTable(): Promise<boolean> {
  if (sessionTableExists !== null) return sessionTableExists;
  const sessionDb = getSessionDb();
  try {
    const { error } = await sessionDb.from(SESSION_TABLE).select("telegram_user_id").limit(0);
    // PGRST204 or PGRST205 means the relation doesn't exist
    if (error && (error.code === "PGRST204" || error.code === "PGRST205" || error.code === "42P01" || error.message?.includes("does not exist"))) {
      sessionTableExists = false;
      return false;
    }
    sessionTableExists = !error;
    return sessionTableExists;
  } catch {
    sessionTableExists = false;
    return false;
  }
}

/**
 * Returns the SQL needed to create the bot_sessions table.
 * Can be run via the Supabase Dashboard SQL Editor or any
 * direct Postgres connection.
 */
export function getSessionTableSQL(): string {
  return `
CREATE TABLE IF NOT EXISTS public.bot_sessions (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  telegram_user_id bigint NOT NULL UNIQUE,
  acharya_slug    text CHECK (acharya_slug IN ('farmer', 'vajra', 'taksha')),
  preferred_lang  text DEFAULT 'en' CHECK (preferred_lang IN ('en', 'hi', 'bn')),
  learner_id      text,
  state_json      jsonb DEFAULT '{}'::jsonb,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);
ALTER TABLE public.bot_sessions ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'bot_sessions' AND policyname = 'Service role full access') THEN
    CREATE POLICY "Service role full access" ON public.bot_sessions FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;
`.trim();
}

/**
 * Load session from the shared (Vajra) database.
 * Falls back to a default empty session if not found or table doesn't exist.
 */
export async function loadSession(telegramUserId: number): Promise<BotSession> {
  const fallback: BotSession = {
    telegram_user_id: telegramUserId,
    acharya_slug: null,
    preferred_lang: "en",
    learner_id: null,
    state_json: {},
    updated_at: new Date().toISOString(),
  };

  if (!(await probeSessionTable())) return fallback;

  const sessionDb = getSessionDb();
  try {
    const { data, error } = await sessionDb
      .from(SESSION_TABLE)
      .select("*")
      .eq("telegram_user_id", telegramUserId)
      .maybeSingle();

    if (error || !data) return fallback;

    return {
      telegram_user_id: data.telegram_user_id,
      acharya_slug: data.acharya_slug || null,
      preferred_lang: data.preferred_lang || "en",
      learner_id: data.learner_id || null,
      state_json: (typeof data.state_json === "object" && data.state_json !== null ? data.state_json : {}) as BotState,
      updated_at: data.updated_at || new Date().toISOString(),
    };
  } catch {
    return fallback;
  }
}

/**
 * Save session to the shared (Vajra) database.
 * Uses upsert on telegram_user_id. No-ops if the table doesn't exist.
 */
export async function saveSession(session: BotSession): Promise<void> {
  if (!(await probeSessionTable())) {
    console.warn("bot_sessions table not found. Session not persisted. Run the migration SQL from GET /api/setup-session.");
    return;
  }
  const sessionDb = getSessionDb();
  try {
    await sessionDb.from(SESSION_TABLE).upsert(
      {
        telegram_user_id: session.telegram_user_id,
        acharya_slug: session.acharya_slug,
        preferred_lang: session.preferred_lang,
        learner_id: session.learner_id,
        state_json: session.state_json,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "telegram_user_id" },
    );
  } catch (err) {
    console.error("Failed to save bot session:", err);
  }
}

/**
 * Delete session (on "Change Acharya"). No-ops if the table doesn't exist.
 */
export async function deleteSession(telegramUserId: number): Promise<void> {
  if (!(await probeSessionTable())) return;
  const sessionDb = getSessionDb();
  try {
    await sessionDb.from(SESSION_TABLE).delete().eq("telegram_user_id", telegramUserId);
  } catch (err) {
    console.error("Failed to delete bot session:", err);
  }
}

// ── Helper: title/body by language ──────────────────────────────────────────

export function titleOf(row: { title_en?: string | null; title_hi?: string | null; title_bn?: string | null }, lang: Lang): string {
  return (lang === "hi" ? row.title_hi : lang === "bn" ? row.title_bn : row.title_en) || row.title_en || "Untitled";
}

export function bodyOf(row: SectionRow, lang: Lang): string {
  return (lang === "hi" ? row.body_hi : lang === "bn" ? row.body_bn : row.body_en) || row.body_en || "Content coming soon.";
}

export function telegramName(from: { first_name?: string; last_name?: string; username?: string }): string {
  const fullName = [from.first_name, from.last_name].filter(Boolean).join(" ").trim();
  return fullName || from.username || "Learner";
}

// ── User lookup functions ───────────────────────────────────────────────────

/**
 * Look up a Telegram-linked learner for a specific Acharya.
 */
export async function getTelegramLearner(
  acharya: AcharyaSlug,
  telegramUserId: number
): Promise<TelegramLearner | null> {
  if (!isDbConfigured(acharya)) return null;
  const config = ACHARYA_TABLE_CONFIG[acharya];

  if (config.telegramTable) {
    // Vajra/Taksha: use separate telegram_accounts/telegram_users table
    const tgTable = acharyaTable(config, "telegramTable", acharya);
    if (!tgTable) return null;
    const { data: tgData } = await tgTable
      .select("learner_id, preferred_lang")
      .eq("telegram_user_id", telegramUserId)
      .maybeSingle();
    if (!tgData?.learner_id) return null;

    const usersTable = acharyaTable(config, "users", acharya);
    if (!usersTable) return null;
    const query = usersTable.select("id, phone, name, preferred_lang").eq("id", tgData.learner_id);
    if (config.hasIsDeleted && config.userCols.isDeleted) {
      query.eq(config.userCols.isDeleted, false);
    }
    const { data } = await query.eq(config.userCols.isActive, true).maybeSingle();
    if (!data) return null;
    return data as TelegramLearner;
  }

  // Farmer: telegram fields on the users table directly
  if (!config.userCols.telegramUserId) return null;
  const usersTable = acharyaTable(config, "users", acharya);
  if (!usersTable) return null;
  const query = usersTable
    .select("id, phone, name, preferred_lang")
    .eq(config.userCols.telegramUserId, telegramUserId)
    .eq(config.userCols.isActive, true);
  if (config.hasIsDeleted && config.userCols.isDeleted) {
    query.eq(config.userCols.isDeleted, false);
  }
  const { data } = await query.maybeSingle();
  return (data as TelegramLearner | null) || null;
}

/**
 * Upsert a Telegram-linked user for a specific Acharya.
 */
export async function upsertTelegramUser(
  acharya: AcharyaSlug,
  telegramUserId: number,
  chatId: number,
  phone: string,
  name: string,
  username: string | null,
  preferredLang: Lang,
): Promise<TelegramLearner | null> {
  if (!isDbConfigured(acharya)) return null;
  const config = ACHARYA_TABLE_CONFIG[acharya];
  const now = new Date().toISOString();

  if (config.telegramTable) {
    // Vajra/Taksha pattern: separate telegram table + users table
    const usersTable = acharyaTable(config, "users", acharya);
    const tgTable = acharyaTable(config, "telegramTable", acharya);
    if (!usersTable || !tgTable) return null;

    // Upsert user
    const userUpsert: Record<string, unknown> = {
      [config.userCols.phone]: phone,
      [config.userCols.name]: name,
      [config.userCols.preferredLang]: preferredLang,
      [config.userCols.isActive]: true,
      [config.userCols.lastSeen]: now,
    };
    const { data: learner } = await usersTable
      .upsert(userUpsert, { onConflict: config.userCols.phone })
      .select("id, phone, name, preferred_lang")
      .single();
    if (!learner) return null;

    // Upsert telegram account
    await tgTable.upsert({
      telegram_user_id: telegramUserId,
      telegram_chat_id: chatId,
      username,
      first_name: name,
      learner_id: learner.id,
      preferred_lang: preferredLang,
      updated_at: now,
    }, { onConflict: "telegram_user_id" });

    return learner as TelegramLearner;
  }

  // Farmer pattern: telegram fields on users table
  const usersTable = acharyaTable(config, "users", acharya);
  if (!usersTable || !config.userCols.telegramUserId) return null;

  // Unlink any previous telegram account with this phone
  await usersTable
    .update({ [config.userCols.telegramUserId]: null, [config.userCols.telegramChatId!]: null })
    .eq(config.userCols.telegramUserId, telegramUserId)
    .neq(config.userCols.phone, phone);

  const telegramFields: Record<string, unknown> = {
    [config.userCols.telegramUserId]: telegramUserId,
    [config.userCols.telegramChatId!]: chatId,
    [config.userCols.telegramUsername!]: username,
    [config.userCols.lastSeen]: now,
  };

  const { data: existing } = await usersTable
    .select("id")
    .eq(config.userCols.phone, phone)
    .maybeSingle();

  if (existing) {
    const { data } = await usersTable
      .update(telegramFields)
      .eq("id", existing.id)
      .select("id, phone, name, preferred_lang")
      .single();
    return (data as TelegramLearner) || null;
  }

  const autoCreate = process.env.AUTO_CREATE_PILOT_USERS === "true";
  if (!autoCreate) return null;

  const { data } = await usersTable
    .insert({
      [config.userCols.phone]: phone,
      [config.userCols.name]: name,
      [config.userCols.preferredLang]: preferredLang,
      [config.userCols.isActive]: true,
      [config.userCols.lastSeen]: now,
      ...telegramFields,
    })
    .select("id, phone, name, preferred_lang")
    .single();
  return (data as TelegramLearner) || null;
}

/**
 * Unlink a Telegram account from its database record (Logout).
 */
export async function unlinkTelegramUser(
  acharya: AcharyaSlug,
  telegramUserId: number
): Promise<boolean> {
  if (!isDbConfigured(acharya)) return false;
  const config = ACHARYA_TABLE_CONFIG[acharya];

  try {
    if (config.telegramTable) {
      // Vajra/Taksha pattern: separate telegram table
      const tgTable = acharyaTable(config, "telegramTable", acharya);
      if (tgTable) {
        await tgTable.delete().eq("telegram_user_id", telegramUserId);
        return true;
      }
    } else {
      // Farmer pattern: telegram fields on users table
      if (config.userCols.telegramUserId) {
        const usersTable = acharyaTable(config, "users", acharya);
        if (usersTable) {
          await usersTable
            .update({
              [config.userCols.telegramUserId]: null,
              [config.userCols.telegramChatId!]: null,
              [config.userCols.telegramUsername!]: null,
            })
            .eq(config.userCols.telegramUserId, telegramUserId);
          return true;
        }
      }
    }
  } catch (err) {
    console.error("Failed to unlink Telegram user:", err);
  }
  return false;
}

// ── Content queries ─────────────────────────────────────────────────────────

export async function loadModules(acharya: AcharyaSlug): Promise<ModuleRow[]> {
  if (!isDbConfigured(acharya)) return [];
  const config = ACHARYA_TABLE_CONFIG[acharya];
  const table = acharyaTable(config, "modules", acharya);
  if (!table) return [];

  let query = table.select("*").order("sort_order");
  if (config.hasIsDeleted) query = query.eq("is_deleted", false);
  if (config.hasStatus) query = query.eq("status", "published");

  const { data } = await query;
  return (data || []) as ModuleRow[];
}

export async function getModuleById(acharya: AcharyaSlug, moduleId: string): Promise<ModuleRow | null> {
  if (!isDbConfigured(acharya)) return null;
  const config = ACHARYA_TABLE_CONFIG[acharya];
  const table = acharyaTable(config, "modules", acharya);
  if (!table) return null;

  let query = table.select("*").eq("id", moduleId);
  if (config.hasIsDeleted) query = query.eq("is_deleted", false);
  const { data } = await query.maybeSingle();
  return (data as ModuleRow | null) || null;
}

export async function loadSections(acharya: AcharyaSlug, moduleId: string): Promise<SectionRow[]> {
  if (!isDbConfigured(acharya)) return [];
  const config = ACHARYA_TABLE_CONFIG[acharya];
  const table = acharyaTable(config, "sections", acharya);
  if (!table) return [];

  let query = table.select("*").eq(config.moduleIdCol, moduleId).order("sort_order");
  if (config.hasIsDeleted) query = query.eq("is_deleted", false);
  const { data } = await query;
  return (data || []) as SectionRow[];
}

export async function loadVideos(acharya: AcharyaSlug, moduleId: string): Promise<VideoRow[]> {
  if (!isDbConfigured(acharya)) return [];
  const config = ACHARYA_TABLE_CONFIG[acharya];
  const table = acharyaTable(config, "videos", acharya);
  if (!table) return [];

  let query = table.select("*").eq(config.moduleIdCol, moduleId).order("sort_order").limit(10);
  if (config.hasIsDeleted) query = query.eq("is_deleted", false);
  if (config.hasStatus) query = query.eq("status", "published");
  const { data } = await query;
  return (data || []) as VideoRow[];
}

// ── Progress queries ────────────────────────────────────────────────────────

export async function getProgress(acharya: AcharyaSlug, learnerId: string, moduleId: string) {
  const config = ACHARYA_TABLE_CONFIG[acharya];
  const table = acharyaTable(config, "progress", acharya);
  if (!table) return { sections_completed: [], completed: false };

  const { data } = await table
    .select("sections_completed, completed")
    .eq(config.learnerIdCol, learnerId)
    .eq(config.moduleIdCol, moduleId)
    .maybeSingle();

  return {
    sections_completed: Array.isArray((data as Record<string, unknown> | null)?.sections_completed)
      ? (data as Record<string, unknown>).sections_completed as string[]
      : [],
    completed: !!(data as Record<string, unknown> | null)?.completed,
  };
}

export async function upsertProgress(
  acharya: AcharyaSlug,
  learnerId: string,
  moduleId: string,
  sectionsCompleted: string[],
  completed: boolean,
) {
  const config = ACHARYA_TABLE_CONFIG[acharya];
  const table = acharyaTable(config, "progress", acharya);
  if (!table) return;

  const record: Record<string, unknown> = {
    [config.learnerIdCol]: learnerId,
    [config.moduleIdCol]: moduleId,
    sections_completed: sectionsCompleted,
    completed,
    completed_at: completed ? new Date().toISOString() : null,
    updated_at: new Date().toISOString(),
  };

  await table.upsert(record, { onConflict: `${config.learnerIdCol},${config.moduleIdCol}` });
}

export async function progressSummary(acharya: AcharyaSlug, learnerId: string) {
  const config = ACHARYA_TABLE_CONFIG[acharya];
  const progressTable = acharyaTable(config, "progress", acharya);
  const quizTable = acharyaTable(config, "quizAttempts", acharya);

  let progressData: Array<Record<string, unknown>> = [];
  let quizData: Array<Record<string, unknown>> = [];

  if (progressTable) {
    const { data } = await progressTable
      .select(`${config.moduleIdCol}, completed, sections_completed`)
      .eq(config.learnerIdCol, learnerId);
    progressData = (data || []) as unknown as Array<Record<string, unknown>>;
  }

  if (quizTable) {
    const { data } = await quizTable
      .select("score, total")
      .eq(config.learnerIdCol, learnerId)
      .order("created_at", { ascending: false })
      .limit(10);
    quizData = (data || []) as unknown as Array<Record<string, unknown>>;
  }

  const completedModules = progressData.filter((p) => !!p.completed).length;
  const quizCount = quizData.length;
  const avgScore = quizCount
    ? Math.round(quizData.reduce((sum, q) => sum + ((q.total as number) ? ((q.score as number) / (q.total as number)) * 100 : 0), 0) / quizCount)
    : 0;

  return { completedModules, quizCount, avgScore };
}

// ── Logging helpers ─────────────────────────────────────────────────────────

export async function logChat(acharya: AcharyaSlug, learnerId: string, lang: Lang, userMessage: string, aiResponse: string, responseTimeMs?: number) {
  const config = ACHARYA_TABLE_CONFIG[acharya];
  const table = acharyaTable(config, "chatLogs", acharya);
  if (!table) return;
  await table.insert({
    [config.learnerIdCol]: learnerId,
    lang,
    user_message: String(userMessage).slice(0, 4000),
    ai_response: String(aiResponse).slice(0, 8000),
    response_time_ms: responseTimeMs ? Math.round(responseTimeMs) : null,
  });
}

export async function logQuizAttempt(acharya: AcharyaSlug, learnerId: string, moduleId: string, score: number, total: number, questions: QuizQuestion[]) {
  const config = ACHARYA_TABLE_CONFIG[acharya];
  const table = acharyaTable(config, "quizAttempts", acharya);
  if (!table) return;
  await table.insert({
    [config.learnerIdCol]: learnerId,
    [config.moduleIdCol]: moduleId,
    score,
    total,
    questions,
  });
}

export async function logApply(acharya: AcharyaSlug, learnerId: string, moduleId: string | undefined, data: Record<string, unknown>) {
  const config = ACHARYA_TABLE_CONFIG[acharya];
  const table = acharyaTable(config, "applyLogs", acharya);
  if (!table) return;
  await table.insert({
    [config.learnerIdCol]: learnerId,
    [config.moduleIdCol]: moduleId || null,
    ...data,
  });
}

export async function logDiary(acharya: AcharyaSlug, learnerId: string, entry: { crop: string; activity: string; expense: number; notes: string }) {
  const config = ACHARYA_TABLE_CONFIG[acharya];
  const table = acharyaTable(config, "diary", acharya);
  if (!table) return;
  await table.insert({
    [config.learnerIdCol]: learnerId,
    entry_date: new Date().toISOString().slice(0, 10),
    crop: entry.crop,
    activity: entry.activity,
    expense: entry.expense,
    notes: entry.notes,
  });
}

export async function logEvent(acharya: AcharyaSlug, learnerId: string | null, eventType: string, eventData?: Record<string, unknown>) {
  const config = ACHARYA_TABLE_CONFIG[acharya];
  const table = acharyaTable(config, "events", acharya);
  if (!table) return;
  await table.insert({
    [config.learnerIdCol]: learnerId,
    event_type: eventType,
    event_data: eventData || null,
  });
}

export async function recentModuleForLearner(acharya: AcharyaSlug, learnerId: string): Promise<ModuleRow | null> {
  const config = ACHARYA_TABLE_CONFIG[acharya];
  const progressTable = acharyaTable(config, "progress", acharya);
  if (progressTable) {
    const { data } = await progressTable
      .select(config.moduleIdCol)
      .eq(config.learnerIdCol, learnerId)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    const record = data as Record<string, unknown> | null;
    if (record?.[config.moduleIdCol]) {
      return getModuleById(acharya, record[config.moduleIdCol] as string);
    }
  }
  const modules = await loadModules(acharya);
  return modules[0] || null;
}
