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
  telegramTable: string | null;
  userCols: {
    phone: string;
    name: string;
    preferredLang: string;
    isActive: string;
    isDeleted: string | null;
    lastSeen: string;
    telegramUserId: string | null;
    telegramChatId: string | null;
    telegramUsername: string | null;
  };
  learnerIdCol: string;
  moduleIdCol: string;
  contentSchema?: string;
  logSchema?: string;
  hasIsDeleted: boolean;
  hasStatus: boolean;
}

const FARMER_CONFIG: AcharyaTableConfig = {
  users: "farmer_users", modules: "farmer_modules", sections: "farmer_sections",
  videos: "farmer_videos", progress: "farmer_progress", quizAttempts: "farmer_quiz_attempts",
  chatLogs: "farmer_chat_logs", applyLogs: "farmer_apply_logs",
  events: "farmer_events", diary: "farmer_diary_entries", aiUsage: "farmer_ai_usage",
  telegramTable: null,
  userCols: { phone: "phone", name: "name", preferredLang: "preferred_lang", isActive: "is_active", isDeleted: "is_deleted", lastSeen: "last_seen_on", telegramUserId: "telegram_user_id", telegramChatId: "telegram_chat_id", telegramUsername: "telegram_username" },
  learnerIdCol: "learner_id", moduleIdCol: "module_id", hasIsDeleted: true, hasStatus: true,
};

const VAJRA_CONFIG: AcharyaTableConfig = {
  users: "learners", modules: "modules", sections: "sections",
  videos: "videos", progress: "progress", quizAttempts: "quiz_attempts",
  chatLogs: "chat_logs", applyLogs: "apply_logs",
  events: null, diary: null, aiUsage: "log_ai_usage",
  telegramTable: "telegram_accounts",
  userCols: { phone: "phone", name: "name", preferredLang: "preferred_lang", isActive: "is_active", isDeleted: null, lastSeen: "last_seen_at", telegramUserId: null, telegramChatId: null, telegramUsername: null },
  learnerIdCol: "learner_id", moduleIdCol: "module_id", hasIsDeleted: false, hasStatus: false,
};

const TAKSHA_CONFIG: AcharyaTableConfig = {
  users: "mst_users", modules: "crs_modules", sections: "crs_sections",
  videos: "crs_videos", progress: "log_progress", quizAttempts: "log_quiz",
  chatLogs: "log_chat", applyLogs: "log_apply",
  events: null, diary: null, aiUsage: "log_ai_usage",
  telegramTable: "telegram_users",
  userCols: { phone: "phone", name: "name", preferredLang: "preferred_lang", isActive: "is_active", isDeleted: "is_deleted", lastSeen: "last_seen_on", telegramUserId: null, telegramChatId: null, telegramUsername: null },
  learnerIdCol: "user_id", moduleIdCol: "module_id",
  contentSchema: "acharya_taksha", logSchema: "gunakul",
  hasIsDeleted: true, hasStatus: false,
};

export const ACHARYA_TABLE_CONFIG: Record<AcharyaSlug, AcharyaTableConfig> = {
  farmer: FARMER_CONFIG, vajra: VAJRA_CONFIG, taksha: TAKSHA_CONFIG,
};

// ── Supabase Clients ────────────────────────────────────────────────────────

const authOpts = { persistSession: false, autoRefreshToken: false } as const;

function makeClient(urlEnv: string, serviceKeyEnv: string, anonKeyEnv: string): DB {
  const u = process.env[urlEnv] || "";
  const sk = process.env[serviceKeyEnv] || "";
  const ak = process.env[anonKeyEnv] || "";
  const k = sk || ak;
  return u && k
    ? createClient(u, k, { auth: authOpts })
    : createClient("https://placeholder.supabase.co", "placeholder", { auth: authOpts });
}

function isConfigured(urlEnv: string, keyEnv: string): boolean {
  const u = process.env[urlEnv] || "";
  const k = process.env[keyEnv] || "";
  return !!u && !!k && !u.includes("placeholder") && k !== "placeholder";
}

// Vajra Supabase — main project
const mainUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const mainServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const mainAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const mainKey = mainServiceKey || mainAnonKey;

export const db: DB = mainUrl && mainKey
  ? createClient(mainUrl, mainKey, { auth: authOpts })
  : createClient("https://placeholder.supabase.co", "placeholder", { auth: authOpts });

// Farmer Supabase — separate project
export const dbFarmer: DB = makeClient("FARMER_SUPABASE_URL", "FARMER_SUPABASE_SERVICE_ROLE_KEY", "FARMER_SUPABASE_ANON_KEY");

// Taksha Supabase — separate project
export const dbTaksha: DB = makeClient("TAKSHA_SUPABASE_URL", "TAKSHA_SUPABASE_SERVICE_ROLE_KEY", "TAKSHA_SUPABASE_ANON_KEY");

export const dbConfigured = isConfigured("NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY");
export const dbFarmerConfigured = isConfigured("FARMER_SUPABASE_URL", "FARMER_SUPABASE_SERVICE_ROLE_KEY");
export const dbTakshaConfigured = isConfigured("TAKSHA_SUPABASE_URL", "TAKSHA_SUPABASE_SERVICE_ROLE_KEY");

// Legacy aliases for backward compat with existing code
export const dbGunakul = db;
export const dbAcharya = db;

/** Get the correct Supabase client for a given Acharya */
function getDb(acharya: AcharyaSlug): DB {
  if (acharya === "taksha") return dbTaksha;
  if (acharya === "farmer") return dbFarmer;
  return db;
}

function isAcharyaConfigured(acharya: AcharyaSlug): boolean {
  if (acharya === "taksha") return dbTakshaConfigured;
  if (acharya === "farmer") return dbFarmerConfigured;
  return dbConfigured;
}

export const ACHARYA_SLUG = process.env.NEXT_PUBLIC_ACHARYA_SLUG || "vajra";

export async function getAcharyaId(): Promise<string | null> {
  if (!dbConfigured) return null;
  const { data } = await db.from("mst_acharyas").select("id").eq("slug", ACHARYA_SLUG).eq("is_deleted", false).maybeSingle();
  return data?.id as string | null;
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
    } catch { return null; }
  }
  return null;
}

const mainEffectiveKey = mainServiceKey || mainAnonKey;
export const effectiveKeyRole = roleOf(mainEffectiveKey);

// ── Acharya-aware query helpers ─────────────────────────────────────────────

function maybeSchema(config: AcharyaTableConfig, kind: "content" | "log"): string | undefined {
  if (kind === "content") return config.contentSchema;
  return config.logSchema;
}

export function acharyaTable(acharya: AcharyaSlug, table: "users" | "modules" | "sections" | "videos" | "progress" | "quizAttempts" | "chatLogs" | "applyLogs" | "events" | "diary" | "aiUsage" | "telegramTable") {
  const config = ACHARYA_TABLE_CONFIG[acharya];
  const name = config[table] as string | null;
  if (!name) return null;
  const client = getDb(acharya);
  const schema = (table === "modules" || table === "sections" || table === "videos")
    ? maybeSchema(config, "content")
    : maybeSchema(config, "log");
  return schema ? client.schema(schema).from(name) : client.from(name);
}

// ── Types ───────────────────────────────────────────────────────────────────

export interface TelegramLearner { id: string; phone: string; name: string | null; preferred_lang: Lang | null; }
export interface ModuleRow { id: string; slug?: string; title_en: string; title_hi?: string | null; title_bn?: string | null; sort_order?: number | null; theory_hours?: number | null; practical_hours?: number | null; }
export interface SectionRow { id: string; module_id: string; title_en: string; title_hi?: string | null; title_bn?: string | null; body_en?: string | null; body_hi?: string | null; body_bn?: string | null; sort_order?: number | null; }
export interface VideoRow { id: string; module_id: string; youtube_id: string; title_en: string; title_hi?: string | null; title_bn?: string | null; duration?: string | null; start_seconds?: number | null; }
export type QuizQuestion = { q: string; options: string[]; correct: number; explanation: string };
export type QuizState = { moduleId: string; lang: Lang; questions: QuizQuestion[]; idx: number; score: number };
export type ToolState = { kind: "weather" } | { kind: "mandi" } | { kind: "fertilizer" } | { kind: "diary"; step: "crop" | "activity" | "expense" | "notes"; crop?: string; activity?: string; expense?: number };
export type ApplyState = { turns: Array<{ text: string; hasPhoto?: boolean }>; moduleId?: string };
export type BotState = { quiz?: QuizState; tool?: ToolState; apply?: ApplyState };

// ── Helpers ─────────────────────────────────────────────────────────────────

export function titleOf(row: { title_en?: string | null; title_hi?: string | null; title_bn?: string | null }, lang: Lang): string {
  return (lang === "hi" ? row.title_hi : lang === "bn" ? row.title_bn : row.title_en) || row.title_en || "Untitled";
}

export function bodyOf(row: SectionRow, lang: Lang): string {
  return (lang === "hi" ? row.body_hi : lang === "bn" ? row.body_bn : row.body_en) || row.body_en || "Content coming soon.";
}

export function telegramName(from: { first_name?: string; last_name?: string; username?: string }): string {
  return [from.first_name, from.last_name].filter(Boolean).join(" ").trim() || from.username || "Learner";
}

// ── User Lookup / Upsert ────────────────────────────────────────────────────

export async function getTelegramLearner(acharya: AcharyaSlug, telegramUserId: number): Promise<TelegramLearner | null> {
  if (!isAcharyaConfigured(acharya)) return null;
  const config = ACHARYA_TABLE_CONFIG[acharya];

  if (config.telegramTable) {
    const tgTable = acharyaTable(acharya, "telegramTable");
    if (!tgTable) return null;
    const { data: tgData } = await tgTable.select("learner_id, preferred_lang").eq("telegram_user_id", telegramUserId).maybeSingle();
    if (!tgData?.learner_id) return null;
    const usersTable = acharyaTable(acharya, "users");
    if (!usersTable) return null;
    const q = usersTable.select("id, phone, name, preferred_lang").eq("id", tgData.learner_id);
    if (config.hasIsDeleted && config.userCols.isDeleted) q.eq(config.userCols.isDeleted, false);
    const { data } = await q.eq(config.userCols.isActive, true).maybeSingle();
    return (data as TelegramLearner) || null;
  }

  if (!config.userCols.telegramUserId) return null;
  const usersTable = acharyaTable(acharya, "users");
  if (!usersTable) return null;
  const q = usersTable.select("id, phone, name, preferred_lang").eq(config.userCols.telegramUserId, telegramUserId).eq(config.userCols.isActive, true);
  if (config.hasIsDeleted && config.userCols.isDeleted) q.eq(config.userCols.isDeleted, false);
  const { data } = await q.maybeSingle();
  return (data as TelegramLearner | null) || null;
}

export async function upsertTelegramUser(acharya: AcharyaSlug, telegramUserId: number, chatId: number, phone: string, name: string, username: string | null, preferredLang: Lang): Promise<TelegramLearner | null> {
  if (!isAcharyaConfigured(acharya)) return null;
  const config = ACHARYA_TABLE_CONFIG[acharya];
  const now = new Date().toISOString();

  if (config.telegramTable) {
    const usersTable = acharyaTable(acharya, "users");
    const tgTable = acharyaTable(acharya, "telegramTable");
    if (!usersTable || !tgTable) return null;

    const userUpsert: Record<string, unknown> = {
      [config.userCols.phone]: phone, [config.userCols.name]: name,
      [config.userCols.preferredLang]: preferredLang, [config.userCols.isActive]: true, [config.userCols.lastSeen]: now,
    };
    const { data: learner } = await usersTable.upsert(userUpsert, { onConflict: config.userCols.phone }).select("id, phone, name, preferred_lang").single();
    if (!learner) return null;

    await tgTable.upsert({ telegram_user_id: telegramUserId, telegram_chat_id: chatId, username, first_name: name, learner_id: learner.id, preferred_lang: preferredLang, updated_at: now }, { onConflict: "telegram_user_id" });
    return learner as TelegramLearner;
  }

  const usersTable = acharyaTable(acharya, "users");
  if (!usersTable || !config.userCols.telegramUserId) return null;

  await usersTable.update({ [config.userCols.telegramUserId]: null, [config.userCols.telegramChatId!]: null }).eq(config.userCols.telegramUserId, telegramUserId).neq(config.userCols.phone, phone);

  const telegramFields: Record<string, unknown> = {
    [config.userCols.telegramUserId]: telegramUserId, [config.userCols.telegramChatId!]: chatId,
    [config.userCols.telegramUsername!]: username, [config.userCols.lastSeen]: now,
  };

  const { data: existing } = await usersTable.select("id").eq(config.userCols.phone, phone).maybeSingle();
  if (existing) {
    const { data } = await usersTable.update(telegramFields).eq("id", existing.id).select("id, phone, name, preferred_lang").single();
    return (data as TelegramLearner) || null;
  }

  if (process.env.AUTO_CREATE_PILOT_USERS !== "true") return null;
  const { data } = await usersTable.insert({ [config.userCols.phone]: phone, [config.userCols.name]: name, [config.userCols.preferredLang]: preferredLang, [config.userCols.isActive]: true, [config.userCols.lastSeen]: now, ...telegramFields }).select("id, phone, name, preferred_lang").single();
  return (data as TelegramLearner) || null;
}

// ── Content Queries ─────────────────────────────────────────────────────────

export async function loadModules(acharya: AcharyaSlug): Promise<ModuleRow[]> {
  if (!isAcharyaConfigured(acharya)) return [];
  const config = ACHARYA_TABLE_CONFIG[acharya];
  const table = acharyaTable(acharya, "modules");
  if (!table) return [];
  let q = table.select("*").order("sort_order");
  if (config.hasIsDeleted) q = q.eq("is_deleted", false);
  if (config.hasStatus) q = q.eq("status", "published");
  const { data } = await q;
  return (data || []) as unknown as ModuleRow[];
}

export async function getModuleById(acharya: AcharyaSlug, moduleId: string): Promise<ModuleRow | null> {
  if (!isAcharyaConfigured(acharya)) return null;
  const config = ACHARYA_TABLE_CONFIG[acharya];
  const table = acharyaTable(acharya, "modules");
  if (!table) return null;
  let q = table.select("*").eq("id", moduleId);
  if (config.hasIsDeleted) q = q.eq("is_deleted", false);
  const { data } = await q.maybeSingle();
  return (data as ModuleRow | null) || null;
}

export async function loadSections(acharya: AcharyaSlug, moduleId: string): Promise<SectionRow[]> {
  if (!isAcharyaConfigured(acharya)) return [];
  const config = ACHARYA_TABLE_CONFIG[acharya];
  const table = acharyaTable(acharya, "sections");
  if (!table) return [];
  let q = table.select("*").eq(config.moduleIdCol, moduleId).order("sort_order");
  if (config.hasIsDeleted) q = q.eq("is_deleted", false);
  const { data } = await q;
  return (data || []) as unknown as SectionRow[];
}

export async function loadVideos(acharya: AcharyaSlug, moduleId: string): Promise<VideoRow[]> {
  if (!isAcharyaConfigured(acharya)) return [];
  const config = ACHARYA_TABLE_CONFIG[acharya];
  const table = acharyaTable(acharya, "videos");
  if (!table) return [];
  let q = table.select("*").eq(config.moduleIdCol, moduleId).order("sort_order").limit(10);
  if (config.hasIsDeleted) q = q.eq("is_deleted", false);
  if (config.hasStatus) q = q.eq("status", "published");
  const { data } = await q;
  return (data || []) as unknown as VideoRow[];
}

// ── Progress ────────────────────────────────────────────────────────────────

export async function getProgress(acharya: AcharyaSlug, learnerId: string, moduleId: string) {
  const config = ACHARYA_TABLE_CONFIG[acharya];
  const table = acharyaTable(acharya, "progress");
  if (!table) return { sections_completed: [] as string[], completed: false };
  const { data } = await table.select("sections_completed, completed").eq(config.learnerIdCol, learnerId).eq(config.moduleIdCol, moduleId).maybeSingle();
  const row = data as Record<string, unknown> | null;
  return { sections_completed: Array.isArray(row?.sections_completed) ? row.sections_completed as string[] : [] as string[], completed: !!row?.completed };
}

export async function upsertProgress(acharya: AcharyaSlug, learnerId: string, moduleId: string, sectionsCompleted: string[], completed: boolean) {
  const config = ACHARYA_TABLE_CONFIG[acharya];
  const table = acharyaTable(acharya, "progress");
  if (!table) return;
  const record: Record<string, unknown> = { [config.learnerIdCol]: learnerId, [config.moduleIdCol]: moduleId, sections_completed: sectionsCompleted, completed, completed_at: completed ? new Date().toISOString() : null, updated_at: new Date().toISOString() };
  await table.upsert(record, { onConflict: `${config.learnerIdCol},${config.moduleIdCol}` });
}

export async function progressSummary(acharya: AcharyaSlug, learnerId: string) {
  const config = ACHARYA_TABLE_CONFIG[acharya];
  const pTable = acharyaTable(acharya, "progress");
  const qTable = acharyaTable(acharya, "quizAttempts");

  let completedModules = 0, quizCount = 0, avgScore = 0;

  if (pTable) {
    const { data } = await pTable.select(`${config.moduleIdCol}, completed`).eq(config.learnerIdCol, learnerId);
    completedModules = ((data || []) as Array<{ completed?: boolean }>).filter((p) => p.completed).length;
  }
  if (qTable) {
    const { data } = await qTable.select("score, total").eq(config.learnerIdCol, learnerId).order("created_at", { ascending: false }).limit(10);
    const rows = (data || []) as Array<{ score: number; total: number }>;
    quizCount = rows.length;
    avgScore = quizCount ? Math.round(rows.reduce((s, r) => s + (r.total ? (r.score / r.total) * 100 : 0), 0) / quizCount) : 0;
  }
  return { completedModules, quizCount, avgScore };
}

export async function recentModuleForLearner(acharya: AcharyaSlug, learnerId: string): Promise<ModuleRow | null> {
  const config = ACHARYA_TABLE_CONFIG[acharya];
  const pTable = acharyaTable(acharya, "progress");
  if (pTable) {
    const { data } = await pTable.select(config.moduleIdCol).eq(config.learnerIdCol, learnerId).order("updated_at", { ascending: false }).limit(1).maybeSingle();
    const row = data as Record<string, unknown> | null;
    if (row?.[config.moduleIdCol]) return getModuleById(acharya, row[config.moduleIdCol] as string);
  }
  const mods = await loadModules(acharya);
  return mods[0] || null;
}

// ── Logging ─────────────────────────────────────────────────────────────────

export async function logChat(acharya: AcharyaSlug, learnerId: string, lang: Lang, userMessage: string, aiResponse: string, responseTimeMs?: number) {
  const config = ACHARYA_TABLE_CONFIG[acharya];
  const table = acharyaTable(acharya, "chatLogs");
  if (!table) return;
  await table.insert({ [config.learnerIdCol]: learnerId, lang, user_message: String(userMessage).slice(0, 4000), ai_response: String(aiResponse).slice(0, 8000), response_time_ms: responseTimeMs ? Math.round(responseTimeMs) : null });
}

export async function logQuizAttempt(acharya: AcharyaSlug, learnerId: string, moduleId: string, score: number, total: number, questions: QuizQuestion[]) {
  const config = ACHARYA_TABLE_CONFIG[acharya];
  const table = acharyaTable(acharya, "quizAttempts");
  if (!table) return;
  await table.insert({ [config.learnerIdCol]: learnerId, [config.moduleIdCol]: moduleId, score, total, questions });
}

export async function logApply(acharya: AcharyaSlug, learnerId: string, moduleId: string | undefined, data: Record<string, unknown>) {
  const config = ACHARYA_TABLE_CONFIG[acharya];
  const table = acharyaTable(acharya, "applyLogs");
  if (!table) return;
  await table.insert({ [config.learnerIdCol]: learnerId, [config.moduleIdCol]: moduleId || null, ...data });
}

export async function logDiary(acharya: AcharyaSlug, learnerId: string, entry: { crop: string; activity: string; expense: number; notes: string }) {
  const config = ACHARYA_TABLE_CONFIG[acharya];
  const table = acharyaTable(acharya, "diary");
  if (!table) return;
  await table.insert({ [config.learnerIdCol]: learnerId, entry_date: new Date().toISOString().slice(0, 10), crop: entry.crop, activity: entry.activity, expense: entry.expense, notes: entry.notes });
}

export async function logEvent(acharya: AcharyaSlug, learnerId: string | null, eventType: string, eventData?: Record<string, unknown>) {
  const config = ACHARYA_TABLE_CONFIG[acharya];
  const table = acharyaTable(acharya, "events");
  if (!table) return;
  await table.insert({ [config.learnerIdCol]: learnerId, event_type: eventType, event_data: eventData || null });
}
