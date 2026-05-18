import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { Context, Markup, Telegraf } from "telegraf";
import { normalizeIndianPhone } from "@/lib/phone";
import { db, dbConfigured } from "@/lib/server/supabase";

export const runtime = "nodejs";
export const preferredRegion = "bom1";
export const maxDuration = 60;

type Lang = "en" | "hi" | "bn";
type TelegramLearner = { id: string; phone: string; name: string | null; preferred_lang: Lang | null };
type TelegramFrom = { id: number; first_name?: string; last_name?: string; username?: string };
type BotContext = Context & {
  from?: TelegramFrom;
  chat?: { id: number };
  match?: RegExpExecArray;
  callbackQuery?: unknown;
  message?: {
    text?: string;
    caption?: string;
    contact?: { phone_number: string; user_id?: number };
    voice?: { file_id: string };
    photo?: Array<{ file_id: string }>;
    document?: { file_id: string; mime_type?: string; file_name?: string };
  };
};

type ModuleRow = {
  id: string;
  slug: string;
  title_en: string;
  title_hi?: string | null;
  title_bn?: string | null;
  theory_hours?: number | null;
  practical_hours?: number | null;
  sort_order?: number | null;
};
type SectionRow = {
  id: string;
  module_id: string;
  title_en: string;
  title_hi?: string | null;
  title_bn?: string | null;
  body_en?: string | null;
  body_hi?: string | null;
  body_bn?: string | null;
  estimated_hours?: number | null;
  sort_order?: number | null;
};
type VideoRow = {
  id: string;
  module_id: string;
  youtube_id: string;
  title_en: string;
  title_hi?: string | null;
  title_bn?: string | null;
  duration?: string | null;
  start_seconds?: number | null;
};
type QuizQuestion = { q: string; options: string[]; correct: number; explanation: string };
type QuizState = { moduleId: string; moduleSlug: string; lang: Lang; questions: QuizQuestion[]; idx: number; score: number };
type InlineButton = ReturnType<typeof Markup.button.callback> | ReturnType<typeof Markup.button.url>;
type ToolState =
  | { kind: "weather" }
  | { kind: "mandi" }
  | { kind: "fertilizer" }
  | { kind: "diary"; step: "crop" | "activity" | "expense" | "notes"; crop?: string; activity?: string; expense?: number };
type ApplyState = { turns: Array<{ text: string; hasPhoto?: boolean }>; moduleId?: string; moduleSlug?: string };
type BotState = { quiz?: QuizState; tool?: ToolState; apply?: ApplyState };
type FarmerProfile = Record<string, unknown> & { telegram_bot_state?: BotState };

const botToken = process.env.TELEGRAM_BOT_TOKEN;
const bot = botToken ? new Telegraf(botToken) : null;
const aiApiKey = process.env.GOOGLE_GEMINI_API_KEY || process.env.GEMINI_API_KEY;
const genAI = aiApiKey ? new GoogleGenerativeAI(aiApiKey) : null;
const model = genAI ? genAI.getGenerativeModel({ model: "gemini-2.5-flash" }) : null;

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://farmer-archarya-app.vercel.app";
const MODULE_PAGE_SIZE = 8;
const CALLBACK_PREFIX = {
  modules: "mods:",
  module: "mod:",
  section: "sec:",
  complete: "done:",
  videos: "vids:",
  quizModule: "qmod:",
  quizAnswer: "qa:",
  applyModule: "apmod:",
  tool: "tool:",
} as const;

const autoCreatePilotUsers =
  process.env.AUTO_CREATE_PILOT_USERS === "true" ||
  (process.env.NODE_ENV === "development" && process.env.AUTO_CREATE_PILOT_USERS !== "false");

const userLangs = new Map<number, Lang>();

const MENU = {
  home: "Home",
  learn: "Learn Modules",
  videos: "Videos",
  quiz: "Quiz",
  ask: "Ask Farmer Acharya",
  apply: "Field Apply",
  tools: "Farm Tools",
  progress: "My Progress",
  language: "Language",
  website: "Open Website",
};

const MENU_KEYBOARD = Markup.keyboard([
  [MENU.home, MENU.learn],
  [MENU.videos, MENU.quiz],
  [MENU.ask, MENU.apply],
  [MENU.tools, MENU.progress],
  [MENU.language, MENU.website],
]).resize();

const PHONE_KEYBOARD = Markup.keyboard([
  [Markup.button.contactRequest("Share my Telegram phone")],
  ["Type phone number"],
]).oneTime().resize();

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function titleOf(row: { title_en?: string | null; title_hi?: string | null; title_bn?: string | null }, lang: Lang): string {
  return (lang === "hi" ? row.title_hi : lang === "bn" ? row.title_bn : row.title_en) || row.title_en || "Untitled";
}

function bodyOf(row: SectionRow, lang: Lang): string {
  return (lang === "hi" ? row.body_hi : lang === "bn" ? row.body_bn : row.body_en) || row.body_en || "Content coming soon.";
}

function telegramName(from: TelegramFrom | undefined): string {
  const fullName = [from?.first_name, from?.last_name].filter(Boolean).join(" ").trim();
  return fullName || from?.username || "Telegram Farmer";
}

function appLink(path = "/"): string {
  return new URL(path, APP_URL).toString();
}

async function getTelegramLearner(telegramUserId?: number): Promise<TelegramLearner | null> {
  if (!dbConfigured || !telegramUserId) return null;
  const { data, error } = await db
    .from("farmer_users")
    .select("id, phone, name, preferred_lang")
    .eq("telegram_user_id", telegramUserId)
    .eq("is_active", true)
    .eq("is_deleted", false)
    .maybeSingle();
  if (error) {
    console.error("telegram learner lookup error:", error);
    return null;
  }
  return (data as TelegramLearner | null) || null;
}

async function getLang(telegramUserId?: number): Promise<Lang> {
  if (!telegramUserId) return "en";
  const cached = userLangs.get(telegramUserId);
  if (cached) return cached;
  const learner = await getTelegramLearner(telegramUserId);
  const lang = learner?.preferred_lang || "en";
  userLangs.set(telegramUserId, lang);
  return lang;
}

async function requireTelegramLogin(ctx: BotContext): Promise<TelegramLearner | null> {
  const learner = await getTelegramLearner(ctx.from?.id);
  if (learner) return learner;
  await ctx.reply("Please login with your phone number first. After login, I will show all Farmer Acharya tools.", PHONE_KEYBOARD);
  return null;
}

async function insertEvent(learnerId: string | null, eventType: string, eventData?: Record<string, unknown>) {
  if (!dbConfigured) return;
  const { error } = await db.from("farmer_events").insert({
    learner_id: learnerId,
    event_type: eventType,
    event_data: eventData || null,
  });
  if (error) console.error("telegram event write error:", error);
}

async function logChat(learnerId: string | null, lang: Lang, userMessage: string, aiResponse: string, responseTimeMs?: number) {
  if (!dbConfigured || !learnerId) return;
  const { error } = await db.from("farmer_chat_logs").insert({
    learner_id: learnerId,
    lang,
    user_message: userMessage.slice(0, 4000),
    ai_response: aiResponse.slice(0, 8000),
    response_time_ms: responseTimeMs ? Math.round(responseTimeMs) : null,
  });
  if (error) console.error("telegram chat log write error:", error);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

async function getProfileAndBotState(learnerId: string): Promise<{ profile: FarmerProfile; botState: BotState }> {
  if (!dbConfigured) return { profile: {}, botState: {} };
  const { data, error } = await db.from("farmer_users").select("farm_profile").eq("id", learnerId).maybeSingle();
  if (error) {
    console.error("telegram bot state lookup error:", error);
    return { profile: {}, botState: {} };
  }
  const profile = isRecord(data?.farm_profile) ? data.farm_profile as FarmerProfile : {};
  const botState = isRecord(profile.telegram_bot_state) ? profile.telegram_bot_state as BotState : {};
  return { profile, botState };
}

async function getBotState(learnerId: string): Promise<BotState> {
  return (await getProfileAndBotState(learnerId)).botState;
}

async function setBotState(learnerId: string, next: BotState) {
  if (!dbConfigured) return;
  const { profile } = await getProfileAndBotState(learnerId);
  const nextProfile: FarmerProfile = { ...profile };
  if (next.quiz || next.tool || next.apply) nextProfile.telegram_bot_state = next;
  else delete nextProfile.telegram_bot_state;
  const { error } = await db.from("farmer_users").update({ farm_profile: nextProfile, updated_at: new Date().toISOString() }).eq("id", learnerId);
  if (error) console.error("telegram bot state update error:", error);
}

async function patchBotState(learnerId: string, patch: BotState) {
  const current = await getBotState(learnerId);
  const next: BotState = { ...current };
  if ("quiz" in patch) next.quiz = patch.quiz;
  if ("tool" in patch) next.tool = patch.tool;
  if ("apply" in patch) next.apply = patch.apply;
  await setBotState(learnerId, next);
}

async function startLogin(ctx: BotContext) {
  if (!dbConfigured) {
    await ctx.reply("Login is not configured yet. Please check Supabase env variables.");
    return;
  }
  await ctx.reply("Send your mobile number to login. You can share your Telegram phone or type a 10-digit Indian mobile number.", PHONE_KEYBOARD);
}

async function loginWithPhone(ctx: BotContext, rawPhone: string) {
  if (!ctx.from?.id || !ctx.chat?.id) return;
  const phone = normalizeIndianPhone(rawPhone);
  if (!phone) {
    await ctx.reply("Please send a valid 10-digit Indian mobile number, for example 9876543210.");
    return;
  }

  const learner = await ensureTelegramLearner(ctx, phone);
  if (!learner) {
    await ctx.reply("Login failed while saving your profile. Please try again.");
    return;
  }

  userLangs.set(ctx.from.id, learner.preferred_lang || "en");
  await insertEvent(learner.id, "telegram_phone_login", { telegramUserId: ctx.from.id, phone: learner.phone });
  await ctx.reply(`Login complete. Welcome, ${learner.name || "farmer"}!`, Markup.removeKeyboard());
  await sendHome(ctx, learner);
}

async function ensureTelegramLearner(ctx: BotContext, phone: string): Promise<TelegramLearner | null> {
  if (!ctx.from || !ctx.chat) return null;
  const telegramUserId = ctx.from.id;
  const now = new Date().toISOString();

  await db
    .from("farmer_users")
    .update({ telegram_user_id: null, telegram_chat_id: null, telegram_username: null })
    .eq("telegram_user_id", telegramUserId)
    .neq("phone", phone);

  const telegramUserFields = {
    telegram_user_id: telegramUserId,
    telegram_chat_id: ctx.chat.id,
    telegram_username: ctx.from.username || null,
    telegram_phone_verified_at: now,
    login_source: "telegram",
    last_seen_on: now,
    updated_at: now,
  };

  const { data: existing, error: lookupError } = await db.from("farmer_users").select("id").eq("phone", phone).maybeSingle();
  if (lookupError) {
    console.error("telegram user lookup error:", lookupError);
    return null;
  }
  if (!existing && !autoCreatePilotUsers) {
    await ctx.reply("This number is not registered for the pilot. Ask your admin to add you.");
    return null;
  }

  const query = existing
    ? db.from("farmer_users").update(telegramUserFields).eq("id", existing.id).select("id, phone, name, preferred_lang").single()
    : db.from("farmer_users").insert({
      phone,
      name: telegramName(ctx.from),
      role: "learner",
      preferred_lang: userLangs.get(telegramUserId) || "en",
      is_admin: false,
      is_active: true,
      is_deleted: false,
      ...telegramUserFields,
    }).select("id, phone, name, preferred_lang").single();

  const { data, error } = await query;
  if (error) {
    console.error("telegram user upsert error:", error);
    return null;
  }
  return data as TelegramLearner;
}

async function loadModules(): Promise<ModuleRow[]> {
  if (!dbConfigured) return [];
  const { data, error } = await db
    .from("farmer_modules")
    .select("id, slug, title_en, title_hi, title_bn, theory_hours, practical_hours, sort_order")
    .eq("is_deleted", false)
    .order("sort_order");
  if (error) {
    console.error("telegram modules error:", error);
    return [];
  }
  return (data || []) as ModuleRow[];
}

async function getModuleById(moduleId: string): Promise<ModuleRow | null> {
  const { data, error } = await db
    .from("farmer_modules")
    .select("id, slug, title_en, title_hi, title_bn, theory_hours, practical_hours, sort_order")
    .eq("id", moduleId)
    .eq("is_deleted", false)
    .maybeSingle();
  if (error) console.error("telegram module lookup error:", error);
  return (data as ModuleRow | null) || null;
}

async function recentModuleForLearner(learnerId: string): Promise<ModuleRow | null> {
  const { data } = await db
    .from("farmer_progress")
    .select("module_id, updated_at")
    .eq("learner_id", learnerId)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (data?.module_id) return getModuleById(data.module_id as string);
  const modules = await loadModules();
  return modules[0] || null;
}

async function sendHome(ctx: BotContext, learner: TelegramLearner) {
  const lang = await getLang(ctx.from?.id);
  const modules = await loadModules();
  const progress = await progressSummary(learner.id);
  const current = await recentModuleForLearner(learner.id);
  const date = new Date().toLocaleDateString(lang === "bn" ? "bn-IN" : lang === "hi" ? "hi-IN" : "en-IN", {
    weekday: "long",
    day: "numeric",
    month: "short",
  });

  const lines = [
    `<b>Farmer Acharya</b>`,
    `${escapeHtml(date)}`,
    "",
    `Modules completed: <b>${progress.completedModules}/${modules.length || 0}</b>`,
    `Quizzes: <b>${progress.quizCount}</b> | Avg score: <b>${progress.avgScore}%</b>`,
    current ? `Continue: <b>${escapeHtml(titleOf(current, lang))}</b>` : "",
    "",
    "Choose a tool below, or type any farming question.",
  ].filter(Boolean);

  await ctx.reply(lines.join("\n"), { parse_mode: "HTML", ...MENU_KEYBOARD });
  await ctx.reply("Quick links:", Markup.inlineKeyboard([
      [Markup.button.callback("Continue Learning", current ? `${CALLBACK_PREFIX.module}${current.id}` : `${CALLBACK_PREFIX.modules}0`)],
      [Markup.button.url("Open Website", appLink("/"))],
    ]));
}

async function progressSummary(learnerId: string) {
  const [{ data: progress }, { data: quizzes }, { data: diary }, { data: applyLogs }] = await Promise.all([
    db.from("farmer_progress").select("module_id, completed, sections_completed, updated_at").eq("learner_id", learnerId),
    db.from("farmer_quiz_attempts").select("module_id, score, total, created_at").eq("learner_id", learnerId).order("created_at", { ascending: false }).limit(5),
    db.from("farmer_diary_entries").select("crop, activity, expense, entry_date").eq("learner_id", learnerId).order("entry_date", { ascending: false }).limit(3),
    db.from("farmer_apply_logs").select("data, created_at").eq("learner_id", learnerId).order("created_at", { ascending: false }).limit(3),
  ]);
  const quizRows = (quizzes || []) as Array<{ score: number; total: number }>;
  const quizCount = quizRows.length;
  const avgScore = quizCount ? Math.round(quizRows.reduce((sum, q) => sum + (q.total ? (q.score / q.total) * 100 : 0), 0) / quizCount) : 0;
  return {
    completedModules: (progress || []).filter((p: { completed?: boolean }) => p.completed).length,
    quizCount,
    avgScore,
    progress: progress || [],
    quizzes: quizzes || [],
    diary: diary || [],
    applyLogs: applyLogs || [],
  };
}

async function sendModuleList(ctx: BotContext, page = 0, mode: "learn" | "videos" | "quiz" | "apply" = "learn") {
  const learner = await requireTelegramLogin(ctx);
  if (!learner) return;
  const lang = await getLang(ctx.from?.id);
  const modules = await loadModules();
  if (modules.length === 0) {
    await ctx.reply("No modules are available yet.");
    return;
  }

  const totalPages = Math.max(1, Math.ceil(modules.length / MODULE_PAGE_SIZE));
  const safePage = Math.min(Math.max(page, 0), totalPages - 1);
  const rows = modules.slice(safePage * MODULE_PAGE_SIZE, (safePage + 1) * MODULE_PAGE_SIZE);
  const prefix =
    mode === "videos" ? CALLBACK_PREFIX.videos :
      mode === "quiz" ? CALLBACK_PREFIX.quizModule :
        mode === "apply" ? CALLBACK_PREFIX.applyModule :
          CALLBACK_PREFIX.module;
  const buttons = rows.map((m, i) => [Markup.button.callback(`${safePage * MODULE_PAGE_SIZE + i + 1}. ${titleOf(m, lang).slice(0, 46)}`, `${prefix}${m.id}`)]);
  const nav = [];
  if (safePage > 0) nav.push(Markup.button.callback("Prev", `${CALLBACK_PREFIX.modules}${mode}:${safePage - 1}`));
  if (safePage < totalPages - 1) nav.push(Markup.button.callback("Next", `${CALLBACK_PREFIX.modules}${mode}:${safePage + 1}`));
  if (nav.length) buttons.push(nav);

  const title =
    mode === "videos" ? "Choose a module for videos" :
      mode === "quiz" ? "Choose a module for quiz" :
        mode === "apply" ? "Choose a module for field apply" :
          "Choose a learning module";
  await insertEvent(learner.id, `telegram_${mode}_modules_opened`);
  await ctx.reply(`<b>${title}</b>\nPage ${safePage + 1}/${totalPages}`, { parse_mode: "HTML", ...Markup.inlineKeyboard(buttons) });
}

async function sendModuleDetails(ctx: BotContext, moduleId: string) {
  const learner = await requireTelegramLogin(ctx);
  if (!learner) return;
  const lang = await getLang(ctx.from?.id);
  const mod = await getModuleById(moduleId);
  if (!mod) {
    await ctx.reply("Module not found.");
    return;
  }

  const { data: sections, error } = await db
    .from("farmer_sections")
    .select("id, module_id, title_en, title_hi, title_bn, body_en, body_hi, body_bn, estimated_hours, sort_order")
    .eq("module_id", moduleId)
    .eq("is_deleted", false)
    .order("sort_order");
  if (error || !sections?.length) {
    await ctx.reply("No sections are available for this module yet.", Markup.inlineKeyboard([[Markup.button.url("Open Learn Page", appLink("/learn"))]]));
    return;
  }

  const sectionRows = sections as SectionRow[];
  const progress = await db
    .from("farmer_progress")
    .select("sections_completed, completed")
    .eq("learner_id", learner.id)
    .eq("module_id", moduleId)
    .maybeSingle();
  const completed = Array.isArray(progress.data?.sections_completed) ? progress.data.sections_completed : [];

  const text = [
    `<b>${escapeHtml(titleOf(mod, lang))}</b>`,
    `${mod.theory_hours || 0}h theory | ${mod.practical_hours || 0}h practical`,
    `Progress: ${completed.length}/${sectionRows.length} sections`,
    "",
    "Choose a section:",
  ].join("\n");
  const buttons: InlineButton[][] = sectionRows.map((s, i) => [
    Markup.button.callback(`${completed.includes(s.id) ? "Done " : ""}${i + 1}. ${titleOf(s, lang).slice(0, 45)}`, `${CALLBACK_PREFIX.section}${s.id}`),
  ]);
  buttons.push([Markup.button.callback("Videos", `${CALLBACK_PREFIX.videos}${moduleId}`), Markup.button.callback("Quiz", `${CALLBACK_PREFIX.quizModule}${moduleId}`)]);
  buttons.push([Markup.button.url("Open Learn Page", appLink("/learn"))]);

  await insertEvent(learner.id, "telegram_module_opened", { moduleId });
  await ctx.reply(text, { parse_mode: "HTML", ...Markup.inlineKeyboard(buttons) });
}

async function sendSection(ctx: BotContext, sectionId: string) {
  const learner = await requireTelegramLogin(ctx);
  if (!learner) return;
  const lang = await getLang(ctx.from?.id);
  const { data, error } = await db
    .from("farmer_sections")
    .select("id, module_id, title_en, title_hi, title_bn, body_en, body_hi, body_bn, estimated_hours, sort_order")
    .eq("id", sectionId)
    .eq("is_deleted", false)
    .maybeSingle();
  if (error || !data) {
    await ctx.reply("Section not found.");
    return;
  }
  const section = data as SectionRow;
  const text = `<b>${escapeHtml(titleOf(section, lang))}</b>\n\n${escapeHtml(bodyOf(section, lang)).slice(0, 3600)}`;
  await insertEvent(learner.id, "telegram_section_opened", { sectionId, moduleId: section.module_id });
  await ctx.reply(text, {
    parse_mode: "HTML",
    ...Markup.inlineKeyboard([
      [Markup.button.callback("Mark Complete", `${CALLBACK_PREFIX.complete}${section.id}`)],
      [Markup.button.callback("Back to Module", `${CALLBACK_PREFIX.module}${section.module_id}`), Markup.button.url("Open App", appLink("/learn"))],
    ]),
  });
}

async function completeSection(ctx: BotContext, sectionId: string) {
  const learner = await requireTelegramLogin(ctx);
  if (!learner) return;
  const { data: section } = await db.from("farmer_sections").select("id, module_id").eq("id", sectionId).maybeSingle();
  if (!section) {
    await ctx.reply("Section not found.");
    return;
  }
  const moduleId = section.module_id as string;
  const { data: existing } = await db
    .from("farmer_progress")
    .select("sections_completed")
    .eq("learner_id", learner.id)
    .eq("module_id", moduleId)
    .maybeSingle();
  const current = Array.isArray(existing?.sections_completed) ? existing.sections_completed as string[] : [];
  const sectionsCompleted = Array.from(new Set([...current, sectionId]));
  const { count } = await db
    .from("farmer_sections")
    .select("id", { count: "exact", head: true })
    .eq("module_id", moduleId)
    .eq("is_deleted", false);
  const completed = !!count && sectionsCompleted.length >= count;
  const { error } = await db.from("farmer_progress").upsert({
    learner_id: learner.id,
    module_id: moduleId,
    sections_completed: sectionsCompleted,
    completed,
    completed_at: completed ? new Date().toISOString() : null,
    updated_at: new Date().toISOString(),
  }, { onConflict: "learner_id,module_id" });
  if (error) {
    console.error("telegram progress error:", error);
    await ctx.reply("Could not save progress right now.");
    return;
  }
  await insertEvent(learner.id, "telegram_section_complete", { sectionId, moduleId });
  await ctx.reply(completed ? "Module complete. Nicely done." : "Section marked complete.", Markup.inlineKeyboard([
    [Markup.button.callback("Back to Module", `${CALLBACK_PREFIX.module}${moduleId}`), Markup.button.callback("Try Quiz", `${CALLBACK_PREFIX.quizModule}${moduleId}`)],
  ]));
}

async function sendVideos(ctx: BotContext, moduleId: string) {
  const learner = await requireTelegramLogin(ctx);
  if (!learner) return;
  const lang = await getLang(ctx.from?.id);
  const mod = await getModuleById(moduleId);
  const { data, error } = await db
    .from("farmer_videos")
    .select("id, module_id, youtube_id, title_en, title_hi, title_bn, duration, start_seconds")
    .eq("module_id", moduleId)
    .eq("is_deleted", false)
    .eq("status", "published")
    .order("sort_order")
    .limit(10);
  if (error || !data?.length) {
    await ctx.reply("No videos are available for this module yet.", Markup.inlineKeyboard([[Markup.button.url("Open Video Page", appLink("/video"))]]));
    return;
  }
  await insertEvent(learner.id, "telegram_videos_opened", { moduleId });
  const lines = [`<b>Videos${mod ? `: ${escapeHtml(titleOf(mod, lang))}` : ""}</b>`];
  for (const v of data as VideoRow[]) {
    const url = `https://www.youtube.com/watch?v=${v.youtube_id}${v.start_seconds ? `&t=${v.start_seconds}s` : ""}`;
    lines.push(`\n<b>${escapeHtml(titleOf(v, lang))}</b>${v.duration ? ` (${escapeHtml(v.duration)})` : ""}\n${url}`);
  }
  await ctx.reply(lines.join("\n"), {
    parse_mode: "HTML",
    ...Markup.inlineKeyboard([[Markup.button.url("Open Video Page", appLink("/video"))]]),
  });
}

function fallbackQuiz(topic: string): QuizQuestion[] {
  return [
    {
      q: `What is the first useful step in ${topic}?`,
      options: ["Observe the field carefully", "Spray immediately", "Harvest at once", "Ignore symptoms"],
      correct: 0,
      explanation: "Good observation helps choose the right action.",
    },
    {
      q: "What should you check before applying fertilizer or pesticide?",
      options: ["Local field condition", "Only phone battery", "Shop color", "Nothing"],
      correct: 0,
      explanation: "Local crop stage, weather, and soil condition matter.",
    },
    {
      q: "Who can confirm serious crop disease advice locally?",
      options: ["Agriculture officer or KVK", "Random rumor", "Only social media", "Nobody"],
      correct: 0,
      explanation: "KVK or local agriculture officers can verify field-specific advice.",
    },
    {
      q: "What habit helps reduce farming cost?",
      options: ["Keeping records", "Buying by guesswork", "Using extra dose", "Skipping scouting"],
      correct: 0,
      explanation: "Records show what worked and what wasted money.",
    },
    {
      q: "How should a new practice be tested first?",
      options: ["Small plot", "Whole farm", "After selling", "Without checking"],
      correct: 0,
      explanation: "Small trials reduce risk.",
    },
  ];
}

async function generateQuiz(moduleId: string, lang: Lang): Promise<{ moduleRow: ModuleRow | null; questions: QuizQuestion[] }> {
  const moduleRow = await getModuleById(moduleId);
  const topic = moduleRow ? titleOf(moduleRow, lang) : "this module";
  if (!model) return { moduleRow, questions: fallbackQuiz(topic) };

  const langInstruction = lang === "bn" ? "Write Bengali in Bengali script." : lang === "hi" ? "Write Hindi in Devanagari script." : "Write simple English.";
  const prompt = `Create a 5-question multiple-choice quiz for Indian farmers.
Topic: ${topic}
Rules:
- ${langInstruction}
- Practical field knowledge only.
- Return ONLY JSON:
{"questions":[{"q":"...","options":["...","...","...","..."],"correct":0,"explanation":"..."}]}`;

  try {
    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.8, maxOutputTokens: 1400, responseMimeType: "application/json" },
    });
    const raw = result.response.text().trim().replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim();
    const parsed = JSON.parse(raw) as { questions?: QuizQuestion[] };
    const questions = Array.isArray(parsed.questions)
      ? parsed.questions.filter((q) => q.q && Array.isArray(q.options) && q.options.length >= 2 && Number.isInteger(q.correct)).slice(0, 5)
      : [];
    return { moduleRow, questions: questions.length ? questions : fallbackQuiz(topic) };
  } catch (err) {
    console.error("telegram quiz generation error:", err);
    return { moduleRow, questions: fallbackQuiz(topic) };
  }
}

async function startQuiz(ctx: BotContext, moduleId: string) {
  const learner = await requireTelegramLogin(ctx);
  if (!learner || !ctx.from?.id) return;
  await ctx.reply("Preparing quiz...");
  const lang = await getLang(ctx.from.id);
  const { moduleRow, questions } = await generateQuiz(moduleId, lang);
  const quiz: QuizState = {
    moduleId,
    moduleSlug: moduleRow?.slug || moduleId,
    lang,
    questions,
    idx: 0,
    score: 0,
  };
  await patchBotState(learner.id, { quiz });
  await insertEvent(learner.id, "telegram_quiz_started", { moduleId });
  await sendQuizQuestion(ctx, quiz);
}

async function sendQuizQuestion(ctx: BotContext, state: QuizState) {
  const q = state.questions[state.idx];
  const buttons = q.options.slice(0, 4).map((opt, i) => [Markup.button.callback(`${String.fromCharCode(65 + i)}. ${opt.slice(0, 48)}`, `${CALLBACK_PREFIX.quizAnswer}${i}`)]);
  const text = `<b>Question ${state.idx + 1}/${state.questions.length}</b>\n\n${escapeHtml(q.q)}`;
  await ctx.reply(text, { parse_mode: "HTML", ...Markup.inlineKeyboard(buttons) });
}

async function answerQuiz(ctx: BotContext, optIdx: number) {
  const learner = await requireTelegramLogin(ctx);
  if (!learner || !ctx.from?.id) return;
  const state = (await getBotState(learner.id)).quiz;
  if (!state) {
    await ctx.reply("Start a quiz from the Quiz menu.");
    return;
  }
  const q = state.questions[state.idx];
  const correct = optIdx === q.correct;
  if (correct) state.score += 1;
  state.idx += 1;

  const lines = [
    correct ? "<b>Correct!</b>" : "<b>Incorrect.</b>",
    q.explanation ? escapeHtml(q.explanation) : "",
  ].filter(Boolean);
  await ctx.reply(lines.join("\n\n"), { parse_mode: "HTML" });

  if (state.idx < state.questions.length) {
    await patchBotState(learner.id, { quiz: state });
    await sendQuizQuestion(ctx, state);
    return;
  }

  await patchBotState(learner.id, { quiz: undefined });
  const { error } = await db.from("farmer_quiz_attempts").insert({
    learner_id: learner.id,
    module_id: state.moduleId,
    score: state.score,
    total: state.questions.length,
    questions: state.questions,
  });
  if (error) console.error("telegram quiz attempt error:", error);
  await insertEvent(learner.id, "telegram_quiz_finished", { moduleId: state.moduleId, score: state.score, total: state.questions.length });
  await ctx.reply(`Quiz complete.\nScore: ${state.score}/${state.questions.length}`, Markup.inlineKeyboard([
    [Markup.button.callback("Retake", `${CALLBACK_PREFIX.quizModule}${state.moduleId}`), Markup.button.url("Open Progress", appLink("/progress"))],
  ]));
}

function mimeFromFileName(fileName?: string): string | null {
  const ext = fileName?.toLowerCase().split(".").pop();
  if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
  if (ext === "png") return "image/png";
  if (ext === "webp") return "image/webp";
  if (ext === "heic") return "image/heic";
  if (ext === "heif") return "image/heif";
  return null;
}

async function fetchTelegramFile(ctx: BotContext, fileId: string, fallbackMimeType = "image/jpeg") {
  const fileLink = await ctx.telegram.getFileLink(fileId);
  const response = await fetch(fileLink.href);
  if (!response.ok) throw new Error(`Telegram file fetch failed: HTTP ${response.status}`);
  const buffer = Buffer.from(await response.arrayBuffer());
  const contentType = response.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase();
  const mimeType = contentType && contentType.startsWith("image/") ? contentType : fallbackMimeType;
  if (buffer.length === 0) throw new Error("Telegram returned an empty image file");
  if (buffer.length > 18 * 1024 * 1024) throw new Error(`Image is too large for inline analysis: ${buffer.length} bytes`);
  return { buffer, mimeType, url: fileLink.href };
}

async function analyzeCropImage(ctx: BotContext, fileId: string, sourceLabel: string, fallbackMimeType = "image/jpeg") {
  const started = Date.now();
  try {
    const learner = await requireTelegramLogin(ctx);
    if (!learner) return;
    if (!model) {
      await ctx.reply("My AI brain is offline.");
      return;
    }
    await ctx.sendChatAction("typing");
    const { buffer, mimeType, url } = await fetchTelegramFile(ctx, fileId, fallbackMimeType);
    const lang = await getLang(ctx.from?.id);
    const caption = ctx.message?.caption ? `\nFarmer caption: ${ctx.message.caption}` : "";
    const prompt = `You are Farmer Acharya, a practical Indian agronomist. Analyze this crop image directly.

Return:
1. likely crop, if identifiable
2. visible symptoms, pest/disease/nutrient/water issue
3. confidence: low/medium/high
4. immediate farmer action steps
5. when to contact local agriculture officer/KVK

If blurry or not a crop, ask for one better photo. Preferred language code: ${lang}.${caption}`;

    const result = await model.generateContent([
      { inlineData: { data: buffer.toString("base64"), mimeType } },
      { text: prompt },
    ]);
    const answer = result.response.text().trim();
    await logChat(learner.id, lang, `[${sourceLabel}: ${mimeType}]`, answer, Date.now() - started);
    console.log("telegram image analyzed", { sourceLabel, mimeType, bytes: buffer.length, url });
    await ctx.reply(answer || "I analyzed the image, but did not get a useful response. Please send a clearer crop photo.");
  } catch (e: unknown) {
    console.error("telegram image analysis error:", e);
    await ctx.reply("I could not analyze that image. Please send a clear, well-lit crop photo showing affected leaves/stem/fruit.");
  }
}

async function answerTextQuestion(ctx: BotContext, text: string) {
  const learner = await requireTelegramLogin(ctx);
  if (!learner) return;
  if (!model) {
    await ctx.reply("My AI brain is offline.");
    return;
  }
  const started = Date.now();
  const lang = await getLang(ctx.from?.id);
  await ctx.sendChatAction("typing");
  let prompt = "You are Farmer Acharya, an agricultural mentor in India. Answer the user in under 150 words.";
  if (text.toLowerCase().startsWith("price ")) prompt += "\nThey are asking for mandi prices. Give a realistic estimate and tell them to verify locally.";
  if (text.toLowerCase().startsWith("weather ")) prompt += "\nThey are asking for weather. Give farming weather advice.";
  prompt += `\nPreferred language code: ${lang}. Match the user's language when possible.\nUser says: ${text}`;
  const result = await model.generateContent(prompt);
  const answer = result.response.text();
  await logChat(learner.id, lang, text, answer, Date.now() - started);
  await ctx.reply(answer);
}

async function sendProgress(ctx: BotContext) {
  const learner = await requireTelegramLogin(ctx);
  if (!learner) return;
  const modules = await loadModules();
  const summary = await progressSummary(learner.id);
  const recentQuiz = (summary.quizzes as Array<{ score: number; total: number; created_at: string }>)[0];
  const recentDiary = (summary.diary as Array<{ crop?: string; activity?: string; entry_date?: string }>)[0];
  const latestApply = (summary.applyLogs as Array<{ data?: { score?: number; nextStep?: string } | null }>)[0];
  const lines = [
    "<b>My Progress</b>",
    `Modules completed: <b>${summary.completedModules}/${modules.length}</b>`,
    `Quizzes: <b>${summary.quizCount}</b>`,
    `Average score: <b>${summary.avgScore}%</b>`,
    recentQuiz ? `Recent quiz: <b>${recentQuiz.score}/${recentQuiz.total}</b>` : "Recent quiz: none yet",
    recentDiary ? `Recent diary: <b>${escapeHtml(recentDiary.crop || "Crop")}</b> - ${escapeHtml(recentDiary.activity || "")}` : "Recent diary: none yet",
    latestApply?.data ? `Latest apply score: <b>${latestApply.data.score ?? "-"}/10</b>` : "Latest apply: none yet",
  ];
  await insertEvent(learner.id, "telegram_progress_opened");
  await ctx.reply(lines.join("\n"), { parse_mode: "HTML", ...Markup.inlineKeyboard([[Markup.button.url("Open Progress Page", appLink("/progress"))]]) });
}

async function sendTools(ctx: BotContext) {
  const learner = await requireTelegramLogin(ctx);
  if (!learner) return;
  await ctx.reply("<b>Farm Tools</b>\nChoose a tool:", {
    parse_mode: "HTML",
    ...Markup.inlineKeyboard([
      [Markup.button.callback("Weather", `${CALLBACK_PREFIX.tool}weather`), Markup.button.callback("Mandi Prices", `${CALLBACK_PREFIX.tool}mandi`)],
      [Markup.button.callback("Crop Calendar", `${CALLBACK_PREFIX.tool}calendar`), Markup.button.callback("Fertilizer Calculator", `${CALLBACK_PREFIX.tool}fertilizer`)],
      [Markup.button.callback("Farm Diary", `${CALLBACK_PREFIX.tool}diary`), Markup.button.url("Open Tools Page", appLink("/tools"))],
    ]),
  });
}

async function handleToolAction(ctx: BotContext, tool: string) {
  const learner = await requireTelegramLogin(ctx);
  if (!learner || !ctx.from?.id) return;
  await patchBotState(learner.id, { tool: undefined });
  await insertEvent(learner.id, "telegram_tool_opened", { tool });
  if (tool === "weather") {
    await patchBotState(learner.id, { tool: { kind: "weather" } });
    await ctx.reply("Send location as: Weather Kolkata\nFor default Kolkata forecast, type: Weather");
  } else if (tool === "mandi") {
    await patchBotState(learner.id, { tool: { kind: "mandi" } });
    await ctx.reply("Send crop and optional state as: Mandi Wheat Punjab\nOr: Mandi Paddy");
  } else if (tool === "calendar") {
    await ctx.reply("<b>Crop Calendar</b>\n1. Seed/Nursery - prepare seed and records.\n2. Sowing - sow at recommended spacing.\n3. Irrigation + nutrients - track water, weeds and pests.\n4. Harvest + selling - grade, store, compare markets.", { parse_mode: "HTML" });
  } else if (tool === "fertilizer") {
    await patchBotState(learner.id, { tool: { kind: "fertilizer" } });
    await ctx.reply("Send: Fertilizer area N P K\nExample: Fertilizer 2 40 20 20\nThis calculates approximate Urea, DAP and MOP kg.");
  } else if (tool === "diary") {
    await patchBotState(learner.id, { tool: { kind: "diary", step: "crop" } });
    await ctx.reply("Farm diary: what crop?");
  }
}

async function handleToolText(ctx: BotContext, text: string): Promise<boolean> {
  const lower = text.toLowerCase();
  const learner = await getTelegramLearner(ctx.from?.id);
  const state = learner ? (await getBotState(learner.id)).tool : undefined;
  if (!state && !lower.startsWith("weather") && !lower.startsWith("mandi") && !lower.startsWith("price") && !lower.startsWith("fertilizer")) return false;

  const verifiedLearner = await requireTelegramLogin(ctx);
  if (!verifiedLearner) return true;

  if (state?.kind === "diary") {
    await handleDiaryStep(ctx, verifiedLearner, state, text);
    return true;
  }

  if (state?.kind === "fertilizer" || lower.startsWith("fertilizer")) {
    const nums = text.replace(/^fertilizer/i, "").trim().split(/\s+/).map(Number).filter(Number.isFinite);
    if (nums.length < 4) {
      await ctx.reply("Send: Fertilizer area N P K\nExample: Fertilizer 2 40 20 20");
      return true;
    }
    const [area, n, p, k] = nums;
    const urea = Math.round((n * area) / 0.46);
    const dap = Math.round((p * area) / 0.46);
    const mop = Math.round((k * area) / 0.60);
    await patchBotState(verifiedLearner.id, { tool: undefined });
    await ctx.reply(`Fertilizer estimate for ${area} acres:\nUrea: ${urea} kg\nDAP: ${dap} kg\nMOP: ${mop} kg\n\nUse only for planning. Final dose should follow soil test, crop stage, label, and local KVK/officer advice.`);
    return true;
  }

  if (state?.kind === "weather" || lower.startsWith("weather")) {
    await patchBotState(verifiedLearner.id, { tool: undefined });
    await sendWeather(ctx, text.replace(/^weather/i, "").trim());
    return true;
  }

  if (state?.kind === "mandi" || lower.startsWith("mandi") || lower.startsWith("price")) {
    await patchBotState(verifiedLearner.id, { tool: undefined });
    await sendMandi(ctx, text.replace(/^(mandi|price)/i, "").trim());
    return true;
  }

  return false;
}

async function sendWeather(ctx: BotContext, query: string) {
  const coords = cityCoords(query);
  const qs = new URLSearchParams({
    latitude: String(coords.lat),
    longitude: String(coords.lon),
    daily: "temperature_2m_max,temperature_2m_min,precipitation_sum,wind_speed_10m_max",
    timezone: "auto",
    forecast_days: "5",
  });
  try {
    const res = await fetch(`https://api.open-meteo.com/v1/forecast?${qs}`);
    const data = await res.json();
    const daily = data.daily || {};
    const lines = [`<b>Weather: ${escapeHtml(coords.label)}</b>`];
    for (let i = 0; i < Math.min(5, daily.time?.length || 0); i += 1) {
      lines.push(`${daily.time[i]}: ${daily.temperature_2m_min?.[i] ?? "-"}-${daily.temperature_2m_max?.[i] ?? "-"} C, rain ${daily.precipitation_sum?.[i] ?? 0} mm`);
    }
    lines.push("\nField tip: avoid spraying before rain or strong wind; check soil moisture before irrigation.");
    await ctx.reply(lines.join("\n"), { parse_mode: "HTML" });
  } catch {
    await ctx.reply("Weather service is unavailable right now. Try again later.");
  }
}

function cityCoords(query: string): { label: string; lat: number; lon: number } {
  const q = query.toLowerCase();
  if (q.includes("delhi")) return { label: "Delhi", lat: 28.6139, lon: 77.2090 };
  if (q.includes("mumbai")) return { label: "Mumbai", lat: 19.0760, lon: 72.8777 };
  if (q.includes("pune")) return { label: "Pune", lat: 18.5204, lon: 73.8567 };
  if (q.includes("patna")) return { label: "Patna", lat: 25.5941, lon: 85.1376 };
  if (q.includes("lucknow")) return { label: "Lucknow", lat: 26.8467, lon: 80.9462 };
  if (q.includes("kolkata")) return { label: "Kolkata", lat: 22.5726, lon: 88.3639 };
  return { label: query || "Kolkata", lat: 22.5726, lon: 88.3639 };
}

async function sendMandi(ctx: BotContext, query: string) {
  const [commodityRaw, ...stateParts] = query.split(/\s+/).filter(Boolean);
  const commodity = commodityRaw || "Paddy";
  const state = stateParts.join(" ");
  const apiKey = (process.env.DATA_GOV_API_KEY || "").trim();
  if (!apiKey) {
    await ctx.reply(`Live mandi prices need DATA_GOV_API_KEY.\n\nFor now, use this as a reminder to compare local market price, transport cost, commission and quality grade.\nQuery: ${commodity}${state ? `, ${state}` : ""}`);
    return;
  }
  const qs = new URLSearchParams({
    "api-key": apiKey,
    format: "json",
    limit: "5",
    "filters[commodity]": commodity,
  });
  if (state) qs.set("filters[state]", state);
  try {
    const res = await fetch(`https://api.data.gov.in/resource/9ef84268-d588-465a-a308-a864a43d0070?${qs}`);
    const data = await res.json();
    const records = Array.isArray(data.records) ? data.records : [];
    if (!records.length) {
      await ctx.reply("No mandi records found. Try another crop spelling or state.");
      return;
    }
    const lines = [`<b>Mandi prices: ${escapeHtml(commodity)}</b>`];
    for (const r of records.slice(0, 5) as Array<Record<string, string>>) {
      lines.push(`${r.state || ""} ${r.market || r.market_name || "-"}: Rs ${r.modal_price || "-"} (${r.arrival_date || r.date || ""})`);
    }
    await ctx.reply(lines.join("\n"), { parse_mode: "HTML" });
  } catch {
    await ctx.reply("Could not load mandi prices right now. Try again later.");
  }
}

async function handleDiaryStep(ctx: BotContext, learner: TelegramLearner, state: Extract<ToolState, { kind: "diary" }>, text: string) {
  if (state.step === "crop") {
    await patchBotState(learner.id, { tool: { ...state, crop: text.slice(0, 120), step: "activity" } });
    await ctx.reply("What activity did you do?");
    return;
  }
  if (state.step === "activity") {
    await patchBotState(learner.id, { tool: { ...state, activity: text.slice(0, 160), step: "expense" } });
    await ctx.reply("Expense amount? Send 0 if none.");
    return;
  }
  if (state.step === "expense") {
    const expense = Number(text.replace(/[^\d.]/g, "")) || 0;
    await patchBotState(learner.id, { tool: { ...state, expense, step: "notes" } });
    await ctx.reply("Any notes? Send '-' if none.");
    return;
  }
  const notes = text === "-" ? "" : text.slice(0, 1000);
  const { error } = await db.from("farmer_diary_entries").insert({
    learner_id: learner.id,
    entry_date: new Date().toISOString().slice(0, 10),
    crop: state.crop || "",
    activity: state.activity || "Field activity",
    expense: state.expense || 0,
    notes,
  });
  await patchBotState(learner.id, { tool: undefined });
  if (error) {
    console.error("telegram diary error:", error);
    await ctx.reply("Could not save diary entry.");
    return;
  }
  await insertEvent(learner.id, "telegram_diary_saved", { crop: state.crop, activity: state.activity });
  await ctx.reply("Diary entry saved.", Markup.inlineKeyboard([[Markup.button.url("Open Tools Page", appLink("/tools"))]]));
}

async function startApply(ctx: BotContext, moduleId: string) {
  const learner = await requireTelegramLogin(ctx);
  if (!learner || !ctx.from?.id) return;
  const mod = await getModuleById(moduleId);
  await patchBotState(learner.id, { apply: { turns: [], moduleId, moduleSlug: mod?.slug || moduleId } });
  await insertEvent(learner.id, "telegram_apply_started", { moduleId });
  await ctx.reply(`Field Apply started${mod ? ` for ${titleOf(mod, await getLang(ctx.from.id))}` : ""}.\n\nSend text, voice, or a field photo. When finished, type: Submit Progress`);
}

async function handleApplyText(ctx: BotContext, text: string): Promise<boolean> {
  const existingLearner = await getTelegramLearner(ctx.from?.id);
  const state = existingLearner ? (await getBotState(existingLearner.id)).apply : undefined;
  if (!state) return false;
  const learner = await requireTelegramLogin(ctx);
  if (!learner) return true;

  if (/^(submit progress|submit|finish)$/i.test(text.trim())) {
    await submitApply(ctx, learner, state);
    await patchBotState(learner.id, { apply: undefined });
    return true;
  }

  state.turns.push({ text: text.slice(0, 1000) });
  await patchBotState(learner.id, { apply: state });
  await ctx.reply("Added to your field report. Send more details/photo/voice, or type: Submit Progress");
  return true;
}

async function addApplyPhoto(ctx: BotContext, learner: TelegramLearner): Promise<boolean> {
  const state = (await getBotState(learner.id)).apply;
  if (!state) return false;
  const caption = ctx.message?.caption || "Field photo attached";
  state.turns.push({ text: caption.slice(0, 1000), hasPhoto: true });
  await patchBotState(learner.id, { apply: state });
  await ctx.reply("Photo added to your field report. Send more details, or type: Submit Progress");
  return true;
}

async function submitApply(ctx: BotContext, learner: TelegramLearner, state: ApplyState) {
  const lang = await getLang(ctx.from?.id);
  const input = state.turns.map((t, i) => `${i + 1}. ${t.text}${t.hasPhoto ? " (photo)" : ""}`).join("\n").slice(0, 5000);
  const hasPhoto = state.turns.some((t) => t.hasPhoto);
  if (!input) {
    await ctx.reply("Send at least one field update before submitting.");
    return;
  }
  let parsed = { summary: input.slice(0, 120), score: 6, feedback: "Good start. Add more field details next time.", nextStep: "Observe the crop again tomorrow and record one concrete action." };
  if (model) {
    try {
      const prompt = `Evaluate this farmer field report. Return ONLY JSON:
{"summary":"one-line summary","score":7,"feedback":"2 short specific sentences","nextStep":"one practical next step"}
Score 1-10. Reply language code: ${lang}.
Report:
${input}`;
      const result = await model.generateContent({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: "application/json", maxOutputTokens: 700 },
      });
      parsed = { ...parsed, ...JSON.parse(result.response.text()) };
    } catch (err) {
      console.error("telegram apply eval error:", err);
    }
  }
  const score = Math.max(0, Math.min(10, Number(parsed.score) || 6));
  const { error } = await db.from("farmer_apply_logs").insert({
    learner_id: learner.id,
    module_id: state.moduleId || null,
    log_type: "self_assessment",
    data: { input, score, feedback: parsed.feedback, nextStep: parsed.nextStep, hasPhoto },
  });
  if (error) console.error("telegram apply save error:", error);
  await insertEvent(learner.id, "telegram_apply_submitted", { moduleId: state.moduleId, score, hasPhoto });
  await ctx.reply(`<b>Application Score: ${score}/10</b>\n\n${escapeHtml(parsed.summary)}\n\n<b>Feedback</b>\n${escapeHtml(parsed.feedback)}\n\n<b>Next step</b>\n${escapeHtml(parsed.nextStep)}`, {
    parse_mode: "HTML",
    ...Markup.inlineKeyboard([[Markup.button.url("Open Apply Page", appLink("/apply"))]]),
  });
}

async function transcribeVoice(ctx: BotContext): Promise<string | null> {
  if (!model || !ctx.message?.voice) return null;
  const fileLink = await ctx.telegram.getFileLink(ctx.message.voice.file_id);
  const response = await fetch(fileLink.href);
  if (!response.ok) throw new Error(`Telegram voice fetch failed: HTTP ${response.status}`);
  const buffer = Buffer.from(await response.arrayBuffer());
  const result = await model.generateContent([
    { text: "Transcribe this farmer's voice message. Return only the spoken text in the same language." },
    { inlineData: { data: buffer.toString("base64"), mimeType: "audio/ogg" } },
  ]);
  return result.response.text().trim();
}

if (bot) {
  bot.start(async (ctx) => {
    const learner = await getTelegramLearner(ctx.from?.id);
    if (learner) {
      await sendHome(ctx, learner);
      return;
    }
    await ctx.reply("Welcome to Farmer Acharya.\n\nPlease login with your phone number first. After login, I will show the learning and farming tools.", PHONE_KEYBOARD);
  });

  bot.command("login", startLogin);
  bot.hears("Type phone number", async (ctx) => ctx.reply("Type your 10-digit Indian mobile number."));

  bot.on("contact", async (ctx) => {
    const contact = ctx.message.contact;
    if (contact.user_id && contact.user_id !== ctx.from.id) {
      await ctx.reply("Please share your own Telegram phone number, or type your mobile number manually.");
      return;
    }
    await loginWithPhone(ctx, contact.phone_number);
  });

  bot.hears(MENU.home, async (ctx) => {
    const learner = await requireTelegramLogin(ctx);
    if (learner) await sendHome(ctx, learner);
  });
  bot.hears(MENU.learn, async (ctx) => sendModuleList(ctx, 0, "learn"));
  bot.hears(MENU.videos, async (ctx) => sendModuleList(ctx, 0, "videos"));
  bot.hears(MENU.quiz, async (ctx) => sendModuleList(ctx, 0, "quiz"));
  bot.hears(MENU.apply, async (ctx) => sendModuleList(ctx, 0, "apply"));
  bot.hears(MENU.tools, sendTools);
  bot.hears(MENU.progress, sendProgress);
  bot.hears(MENU.website, async (ctx) => {
    const learner = await requireTelegramLogin(ctx);
    if (!learner) return;
    await ctx.reply("Open Farmer Acharya website:", Markup.inlineKeyboard([[Markup.button.url("Open Website", appLink("/"))]]));
  });
  bot.hears(MENU.ask, async (ctx) => {
    const learner = await requireTelegramLogin(ctx);
    if (!learner) return;
    await ctx.reply("Ask me by typing a question, recording a voice message, or sending a crop photo.");
  });

  bot.hears(MENU.language, async (ctx) => {
    const learner = await requireTelegramLogin(ctx);
    if (!learner) return;
    await ctx.reply("Choose your preferred language:", {
      ...Markup.inlineKeyboard([
        [Markup.button.callback("English", "lang_en")],
        [Markup.button.callback("Hindi", "lang_hi")],
        [Markup.button.callback("Bengali", "lang_bn")],
      ]),
    });
  });

  bot.action(/^lang_(en|hi|bn)$/, async (ctx) => {
    const learner = await requireTelegramLogin(ctx);
    if (!learner) return;
    const lang = ctx.match[1] as Lang;
    if (ctx.from?.id) userLangs.set(ctx.from.id, lang);
    await db.from("farmer_users").update({ preferred_lang: lang, updated_at: new Date().toISOString() }).eq("id", learner.id);
    await ctx.answerCbQuery(`Language set to ${lang}.`);
    await ctx.editMessageText(`Language set to ${lang}.`);
  });

  bot.action(/^mods:(learn|videos|quiz|apply):(\d+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    await sendModuleList(ctx, Number(ctx.match[2]), ctx.match[1] as "learn" | "videos" | "quiz" | "apply");
  });
  bot.action(/^mods:(\d+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    await sendModuleList(ctx, Number(ctx.match[1]), "learn");
  });
  bot.action(/^mod:(.+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    await sendModuleDetails(ctx, ctx.match[1]);
  });
  bot.action(/^sec:(.+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    await sendSection(ctx, ctx.match[1]);
  });
  bot.action(/^done:(.+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    await completeSection(ctx, ctx.match[1]);
  });
  bot.action(/^vids:(.+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    await sendVideos(ctx, ctx.match[1]);
  });
  bot.action(/^qmod:(.+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    await startQuiz(ctx, ctx.match[1]);
  });
  bot.action(/^qa:(\d+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    await answerQuiz(ctx, Number(ctx.match[1]));
  });
  bot.action(/^apmod:(.+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    await startApply(ctx, ctx.match[1]);
  });
  bot.action(/^tool:(weather|mandi|calendar|fertilizer|diary)$/, async (ctx) => {
    await ctx.answerCbQuery();
    await handleToolAction(ctx, ctx.match[1]);
  });

  bot.on("voice", async (ctx) => {
    const learner = await requireTelegramLogin(ctx);
    if (!learner) return;
    try {
      await ctx.sendChatAction("typing");
      const started = Date.now();
      const transcript = await transcribeVoice(ctx);
      if (!transcript) {
        await ctx.reply("I could not understand that voice message. Please try again.");
        return;
      }
      const applyState = (await getBotState(learner.id)).apply;
      if (applyState) {
        const state = applyState;
        state.turns.push({ text: transcript });
        await patchBotState(learner.id, { apply: state });
        await ctx.reply(`Added voice note: "${transcript}"\n\nSend more details/photo, or type: Submit Progress`);
        return;
      }
      const lang = await getLang(ctx.from?.id);
      const prompt = `You are Farmer Acharya, an agricultural mentor in India. Answer this transcribed farmer voice message in under 150 words. Preferred language: ${lang}.\nMessage: ${transcript}`;
      const result = await model!.generateContent(prompt);
      const answer = result.response.text();
      await logChat(learner.id, lang, `[voice] ${transcript}`, answer, Date.now() - started);
      await ctx.reply(answer);
    } catch (err) {
      console.error("telegram voice error:", err);
      await ctx.reply("I could not process that voice message. Please try again.");
    }
  });

  bot.on("photo", async (ctx) => {
    const learner = await requireTelegramLogin(ctx);
    if (!learner) return;
    if (await addApplyPhoto(ctx, learner)) return;
    const photo = ctx.message.photo?.[ctx.message.photo.length - 1];
    if (!photo) {
      await ctx.reply("Please send a clear crop photo.");
      return;
    }
    await analyzeCropImage(ctx, photo.file_id, "crop photo", "image/jpeg");
  });

  bot.on("document", async (ctx) => {
    const learner = await requireTelegramLogin(ctx);
    if (!learner) return;
    if (await addApplyPhoto(ctx, learner)) return;
    const document = ctx.message.document;
    const mimeType = document?.mime_type || mimeFromFileName(document?.file_name);
    if (!document || !mimeType?.startsWith("image/")) {
      await ctx.reply("Please send an image file, or use Telegram's photo option.");
      return;
    }
    await analyzeCropImage(ctx, document.file_id, "crop image file", mimeType);
  });

  bot.on("text", async (ctx) => {
    const text = ctx.message.text.trim();
    if (Object.values(MENU).includes(text)) return;

    const typedPhone = normalizeIndianPhone(text);
    if (typedPhone) {
      await loginWithPhone(ctx, typedPhone);
      return;
    }
    if (await handleApplyText(ctx, text)) return;
    if (await handleToolText(ctx, text)) return;

    try {
      await answerTextQuestion(ctx, text);
    } catch (error) {
      console.error("telegram text error:", error);
      await ctx.reply("I could not answer that right now. Please try again.");
    }
  });
}

export async function POST(request: Request) {
  try {
    if (!botToken || !bot) return NextResponse.json({ error: "Bot token not set" }, { status: 500 });
    const body = await request.json();
    await bot.handleUpdate(body);
    return NextResponse.json({ status: "OK" });
  } catch (error: unknown) {
    console.error("Telegram webhook error:", error);
    const details = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: "Internal Server Error", details }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    status: botToken ? "Configured" : "Missing TELEGRAM_BOT_TOKEN",
    database: dbConfigured ? "Configured" : "Missing Supabase configuration",
  });
}
