import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { Context, Markup, Telegraf } from "telegraf";
import { normalizeIndianPhone } from "@/lib/phone";
import {
  AcharyaSlug,
  ACHARYA_NAMES,
  getSystemPrompt,
} from "@/lib/system-prompts";
import {
  isDbConfigured,
  type Lang,
  type TelegramLearner,
  type ModuleRow,
  type SectionRow,
  type VideoRow,
  type QuizQuestion,
  type QuizState,
  type ToolState,
  type ApplyState,
  type BotState,
  type BotSession,
  getTelegramLearner,
  upsertTelegramUser,
  loadModules,
  getModuleById,
  loadSections,
  loadVideos,
  getProgress,
  upsertProgress,
  progressSummary,
  logChat,
  logQuizAttempt,
  logApply,
  logDiary,
  logEvent,
  recentModuleForLearner,
  titleOf,
  bodyOf,
  telegramName,
  loadSession,
  saveSession,
  deleteSession,
  unlinkTelegramUser,
} from "@/lib/server/supabase";

export const runtime = "nodejs";
export const preferredRegion = "bom1";
export const maxDuration = 60;

// ── Types ───────────────────────────────────────────────────────────────────

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
type InlineButton = ReturnType<typeof Markup.button.callback> | ReturnType<typeof Markup.button.url>;

// ── AI Setup ────────────────────────────────────────────────────────────────

const botToken = process.env.TELEGRAM_BOT_TOKEN;
const bot = botToken ? new Telegraf(botToken) : null;
const aiApiKey = process.env.GEMINI_API_KEY;
const genAI = aiApiKey ? new GoogleGenerativeAI(aiApiKey) : null;
const model = genAI ? genAI.getGenerativeModel({ model: "gemini-2.5-flash" }) : null;

// ── App URLs ────────────────────────────────────────────────────────────────

const APP_URLS: Record<AcharyaSlug, string> = {
  farmer: process.env.FARMER_APP_URL || "https://farmer-acharya-app.vercel.app",
  vajra: process.env.VAJRA_APP_URL || "https://vajra-acharya.vercel.app",
  taksha: process.env.TAKSHA_APP_URL || "https://taksha-acharya.vercel.app",
};

// ── Session Management (BUG-06 fix: DB-backed instead of in-memory) ────────

const MODULE_PAGE_SIZE = 8;

// ── Callback prefixes ───────────────────────────────────────────────────────

const CP = {
  acharya: "ach:",
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

// ── Helpers ─────────────────────────────────────────────────────────────────

function escapeHtml(value: unknown): string {
  return String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function appLink(acharya: AcharyaSlug, path = "/"): string {
  return new URL(path, APP_URLS[acharya]).toString();
}

// ── Session helpers (DB-backed, BUG-06 fix) ─────────────────────────────────

async function getSessionForUser(telegramUserId: number): Promise<BotSession> {
  return loadSession(telegramUserId);
}

async function getLang(telegramUserId?: number): Promise<Lang> {
  if (!telegramUserId) return "en";
  const session = await loadSession(telegramUserId);
  return session.preferred_lang || "en";
}

async function getAcharya(telegramUserId?: number): Promise<AcharyaSlug | null> {
  if (!telegramUserId) return null;
  const session = await loadSession(telegramUserId);
  return session.acharya_slug || null;
}

async function getBotState(telegramUserId: number): Promise<BotState> {
  const session = await loadSession(telegramUserId);
  return session.state_json || {};
}

async function patchSession(telegramUserId: number, patch: Partial<BotSession>): Promise<void> {
  const session = await loadSession(telegramUserId);
  await saveSession({ ...session, ...patch, telegram_user_id: telegramUserId });
}

async function patchBotState(telegramUserId: number, statePatch: Partial<BotState>): Promise<void> {
  const session = await loadSession(telegramUserId);
  const currentState = session.state_json || {};
  const newState: BotState = { ...currentState, ...statePatch };
  // Clean up undefined values
  if (!newState.quiz) delete newState.quiz;
  if (!newState.tool) delete newState.tool;
  if (!newState.apply) delete newState.apply;
  if (newState.pendingPhone === undefined) delete newState.pendingPhone;
  await saveSession({ ...session, state_json: newState });
}

// ── Menus ───────────────────────────────────────────────────────────────────

function acharyaPickerKeyboard() {
  return Markup.inlineKeyboard([
    [Markup.button.callback("Farmer Acharya", `${CP.acharya}farmer`)],
    [Markup.button.callback("Vajra Acharya", `${CP.acharya}vajra`)],
    [Markup.button.callback("Taksha Acharya", `${CP.acharya}taksha`)],
  ]);
}


const MENU_LABELS = {
  home: { en: "Home", hi: "होम", bn: "হোম" },
  learnModules: { en: "Learn Modules", hi: "मॉड्यूल सीखें", bn: "মডিউল শিখুন" },
  videos: { en: "Videos", hi: "वीडियो", bn: "ভিডিও" },
  quiz: { en: "Quiz", hi: "प्रश्नोत्तरी", bn: "কুইজ" },
  fieldApply: { en: "Field Apply", hi: "फील्ड अप्लाई", bn: "মাঠে প্রয়োগ" },
  myProgress: { en: "My Progress", hi: "मेरी प्रगति", bn: "আমার অগ্রগতি" },
  askFarmer: { en: "Ask Farmer Acharya", hi: "किसान आचार्य से पूछें", bn: "কৃষক আচার্যকে জিজ্ঞাসা করুন" },
  askVajra: { en: "Ask Vajra Acharya", hi: "वज्र आचार्य से पूछें", bn: "বজ্র আচার্যকে জিজ্ঞাসা করুন" },
  askTaksha: { en: "Ask Taksha Acharya", hi: "तक्ष आचार्य से पूछें", bn: "তক্ষ আচার্যকে জিজ্ঞাসা করুন" },
  farmTools: { en: "Farm Tools", hi: "कृषि उपकरण", bn: "কৃষি সরঞ্জাম" },
  openWebsite: { en: "Open Website", hi: "वेबसाइट खोलें", bn: "ওয়েবসাইট খুলুন" },
  language: { en: "Language", hi: "भाषा", bn: "भाषा" },
  changeAcharya: { en: "Change Acharya", hi: "आचार्य बदलें", bn: "আচার্য পরিবর্তন করুন" },
  logout: { en: "Logout", hi: "लॉग आउट", bn: "লॉग আউট" },
};

function mainMenuKeyboard(acharya: AcharyaSlug, lang: Lang = "en") {
  const L = (key: keyof typeof MENU_LABELS) => MENU_LABELS[key][lang] || MENU_LABELS[key].en;

  let askKey: keyof typeof MENU_LABELS = "askFarmer";
  if (acharya === "vajra") askKey = "askVajra";
  else if (acharya === "taksha") askKey = "askTaksha";

  const rows: string[][] = [
    [L("home"), L("learnModules")],
    [L("videos"), L("quiz")],
    [L(askKey), L("fieldApply")],
  ];

  if (acharya === "farmer") {
    rows.push([L("farmTools"), L("myProgress")]);
    rows.push([L("language"), L("openWebsite")]);
  } else {
    rows.push([L("myProgress"), L("language")]);
    rows.push([L("openWebsite")]);
  }

  rows.push([L("changeAcharya"), L("logout")]);

  return Markup.keyboard(rows).resize();
}

function phoneKeyboard() {
  return Markup.keyboard([
    [Markup.button.contactRequest("Share my Telegram phone")],
    ["Type phone number"],
  ]).oneTime().resize();
}

function askKeyboard() {
  return Markup.keyboard([
    ["Cancel Ask"]
  ]).resize();
}

async function sendDefaultMessage(ctx: BotContext, acharya: AcharyaSlug, lang: Lang) {
  const acharyaName = ACHARYA_NAMES[acharya];
  const askBtnLabel = `Ask ${acharyaName}`;
  let text = "";
  if (lang === "hi") {
    text = `कृपया मेनू से एक विकल्प चुनें।\n\nप्रश्न पूछने के लिए <b>"${askBtnLabel}"</b> पर क्लिक करें, या अपनी प्रगति रिपोर्ट दर्ज करने के लिए <b>"Field Apply"</b> चुनें।`;
  } else if (lang === "bn") {
    text = `দয়া করে মেনু থেকে একটি বিকল্প নির্বাচন করুন।\n\nপ্রশ্ন জিজ্ঞাসা করতে <b>"${askBtnLabel}"</b> এ ক্লিক করুন, অথবা আপনার অগ্রগতি প্রতিবেদন জমা দিতে <b>"Field Apply"</b> নির্বাচন করুন।`;
  } else {
    text = `Please select an option from the menu.\n\nClick <b>"${askBtnLabel}"</b> to ask a question, or select <b>"Field Apply"</b> to submit a progress report.`;
  }
  await ctx.reply(text, { parse_mode: "HTML", ...mainMenuKeyboard(acharya, lang) });
}

// ── Acharya Selection / Authentication ───────────────────────────────────────

async function promptAuthentication(ctx: BotContext) {
  await ctx.reply(
    "Welcome to Acharya!\n\nPlease authenticate with your phone number to get started.",
    phoneKeyboard(),
  );
}

async function showAcharyaPicker(ctx: BotContext) {
  if (!ctx.from?.id) return;
  const session = await getSessionForUser(ctx.from.id);
  const phone = session.state_json?.authenticatedPhone;
  if (!phone) {
    await promptAuthentication(ctx);
    return;
  }
  await ctx.reply(
    "Welcome to Acharya!\n\nChoose your Acharya to get started:",
    acharyaPickerKeyboard(),
  );
}

async function setAcharya(ctx: BotContext, acharya: AcharyaSlug) {
  if (!ctx.from?.id) return;

  const session = await getSessionForUser(ctx.from.id);
  const phone = session.state_json?.authenticatedPhone;
  if (!phone) {
    await promptAuthentication(ctx);
    return;
  }

  // Persist acharya choice to DB session
  await patchSession(ctx.from.id, { acharya_slug: acharya });

  // Automatically log in with the authenticated phone number
  await loginWithPhone(ctx, acharya, phone);
}

async function authenticateUserWithPhone(ctx: BotContext, rawPhone: string) {
  if (!ctx.from?.id) return;
  const phone = normalizeIndianPhone(rawPhone);
  if (!phone) {
    await ctx.reply("Please send a valid 10-digit Indian mobile number, for example 9876543210.");
    return;
  }

  // Save the pending phone to state_json and ask for OTP
  await patchBotState(ctx.from.id, { pendingPhone: phone });
  await ctx.reply(`We have sent an OTP to ${phone}.\n\nPlease enter the OTP to continue. (Pilot OTP: 123456)`, Markup.removeKeyboard());
}

// ── Login ───────────────────────────────────────────────────────────────────

async function loginWithPhone(ctx: BotContext, acharya: AcharyaSlug, rawPhone: string) {
  if (!ctx.from?.id || !ctx.chat?.id) return;
  const phone = normalizeIndianPhone(rawPhone);
  if (!phone) {
    await ctx.reply("Please send a valid 10-digit Indian mobile number, for example 9876543210.");
    return;
  }

  const name = telegramName(ctx.from);
  const session = await getSessionForUser(ctx.from.id);
  const existingLang = session.preferred_lang || "en";

  const learner = await upsertTelegramUser(
    acharya,
    ctx.from.id,
    ctx.chat.id,
    phone,
    name,
    ctx.from.username || null,
    existingLang,
  );

  if (!learner) {
    await ctx.reply("Login failed while saving your profile. Please try again.");
    return;
  }

  // Persist to DB session
  await patchSession(ctx.from.id, {
    preferred_lang: learner.preferred_lang || "en",
    learner_id: learner.id,
  });

  await logEvent(acharya, learner.id, "telegram_login", { acharya });
  await ctx.reply(`Login complete. Welcome, ${learner.name || "learner"}!`, Markup.removeKeyboard());
  await sendHome(ctx, acharya, learner);
}

// ── Home Dashboard ──────────────────────────────────────────────────────────

async function sendHome(ctx: BotContext, acharya: AcharyaSlug, learner: TelegramLearner) {
  const lang = await getLang(ctx.from?.id);
  const modules = await loadModules(acharya);
  const summary = await progressSummary(acharya, learner.id);
  const current = await recentModuleForLearner(acharya, learner.id);
  const date = new Date().toLocaleDateString(lang === "bn" ? "bn-IN" : lang === "hi" ? "hi-IN" : "en-IN", {
    weekday: "long", day: "numeric", month: "short",
  });

  const lines = [
    `<b>${ACHARYA_NAMES[acharya]}</b>`,
    `${escapeHtml(date)}`,
    "",
    `Modules completed: <b>${summary.completedModules}/${modules.length || 0}</b>`,
    `Quizzes: <b>${summary.quizCount}</b> | Avg score: <b>${summary.avgScore}%</b>`,
    current ? `Continue: <b>${escapeHtml(titleOf(current, lang))}</b>` : "",
    "",
    "Choose a tool below, or type any question.",
  ].filter(Boolean);

  await ctx.reply(lines.join("\n"), { parse_mode: "HTML", ...mainMenuKeyboard(acharya, lang) });
  const quickButtons: InlineButton[] = [];
  if (current) quickButtons.push(Markup.button.callback("Continue Learning", `${CP.module}${current.id}`));
  quickButtons.push(Markup.button.url("Open Website", appLink(acharya, "/")));
  await ctx.reply("Quick links:", Markup.inlineKeyboard([quickButtons]));
}

// ── Module List ─────────────────────────────────────────────────────────────

async function sendModuleList(
  ctx: BotContext,
  acharya: AcharyaSlug,
  learner: TelegramLearner,
  page = 0,
  mode: "learn" | "videos" | "quiz" | "apply" = "learn",
) {
  const lang = await getLang(ctx.from?.id);
  const modules = await loadModules(acharya);
  if (modules.length === 0) {
    await ctx.reply("No modules are available yet.");
    return;
  }

  const totalPages = Math.max(1, Math.ceil(modules.length / MODULE_PAGE_SIZE));
  const safePage = Math.min(Math.max(page, 0), totalPages - 1);
  const rows = modules.slice(safePage * MODULE_PAGE_SIZE, (safePage + 1) * MODULE_PAGE_SIZE);
  const prefix =
    mode === "videos" ? CP.videos :
    mode === "quiz" ? CP.quizModule :
    mode === "apply" ? CP.applyModule : CP.module;

  const buttons: InlineButton[][] = rows.map((m, i) => [
    Markup.button.callback(`${safePage * MODULE_PAGE_SIZE + i + 1}. ${titleOf(m, lang).slice(0, 46)}`, `${prefix}${m.id}`),
  ]);
  const nav: InlineButton[] = [];
  if (safePage > 0) nav.push(Markup.button.callback("Prev", `${CP.modules}${mode}:${safePage - 1}`));
  if (safePage < totalPages - 1) nav.push(Markup.button.callback("Next", `${CP.modules}${mode}:${safePage + 1}`));
  if (nav.length) buttons.push(nav);

  const title =
    mode === "videos" ? "Choose a module for videos" :
    mode === "quiz" ? "Choose a module for quiz" :
    mode === "apply" ? "Choose a module for field apply" : "Choose a learning module";

  await ctx.reply(`<b>${title}</b>\nPage ${safePage + 1}/${totalPages}`, {
    parse_mode: "HTML", ...Markup.inlineKeyboard(buttons),
  });
}

// ── Module Details (Sections) ───────────────────────────────────────────────

async function sendModuleDetails(ctx: BotContext, acharya: AcharyaSlug, learner: TelegramLearner, moduleId: string) {
  const lang = await getLang(ctx.from?.id);
  const mod = await getModuleById(acharya, moduleId);
  if (!mod) { await ctx.reply("Module not found."); return; }

  const sections = await loadSections(acharya, moduleId);
  if (!sections.length) {
    await ctx.reply("No sections available yet.", Markup.inlineKeyboard([
      [Markup.button.url("Open Learn Page", appLink(acharya, "/learn"))],
    ]));
    return;
  }

  const progress = await getProgress(acharya, learner.id, moduleId);
  const completed = progress.sections_completed;

  const text = [
    `<b>${escapeHtml(titleOf(mod, lang))}</b>`,
    `Progress: ${completed.length}/${sections.length} sections`,
    "",
    "Choose a section:",
  ].join("\n");

  const buttons: InlineButton[][] = sections.map((s, i) => [
    Markup.button.callback(`${completed.includes(s.id) ? "Done " : ""}${i + 1}. ${titleOf(s, lang).slice(0, 45)}`, `${CP.section}${s.id}`),
  ]);
  buttons.push([Markup.button.callback("Videos", `${CP.videos}${moduleId}`), Markup.button.callback("Quiz", `${CP.quizModule}${moduleId}`)]);
  buttons.push([Markup.button.url("Open Learn Page", appLink(acharya, "/learn"))]);

  await ctx.reply(text, { parse_mode: "HTML", ...Markup.inlineKeyboard(buttons) });
}

// ── Section Content ─────────────────────────────────────────────────────────

async function sendSection(ctx: BotContext, acharya: AcharyaSlug, learner: TelegramLearner, sectionId: string) {
  const lang = await getLang(ctx.from?.id);
  // Need to find the section across all modules
  const modules = await loadModules(acharya);
  let section: SectionRow | null = null;
  for (const mod of modules) {
    const secs = await loadSections(acharya, mod.id);
    const found = secs.find((s) => s.id === sectionId);
    if (found) { section = found; break; }
  }
  if (!section) { await ctx.reply("Section not found."); return; }

  const text = `<b>${escapeHtml(titleOf(section, lang))}</b>\n\n${escapeHtml(bodyOf(section, lang)).slice(0, 3600)}`;
  await ctx.reply(text, {
    parse_mode: "HTML",
    ...Markup.inlineKeyboard([
      [Markup.button.callback("Mark Complete", `${CP.complete}${section.id}`)],
      [Markup.button.callback("Back to Module", `${CP.module}${section.module_id}`), Markup.button.url("Open App", appLink(acharya, "/learn"))],
    ]),
  });
}

// ── Complete Section ────────────────────────────────────────────────────────

async function completeSection(ctx: BotContext, acharya: AcharyaSlug, learner: TelegramLearner, sectionId: string) {
  const modules = await loadModules(acharya);
  let sectionModuleId = "";
  for (const mod of modules) {
    const secs = await loadSections(acharya, mod.id);
    if (secs.some((s) => s.id === sectionId)) { sectionModuleId = mod.id; break; }
  }
  if (!sectionModuleId) { await ctx.reply("Section not found."); return; }

  const existing = await getProgress(acharya, learner.id, sectionModuleId);
  const sectionsCompleted = Array.from(new Set([...existing.sections_completed, sectionId]));
  const allSections = await loadSections(acharya, sectionModuleId);
  const completed = allSections.length > 0 && sectionsCompleted.length >= allSections.length;

  await upsertProgress(acharya, learner.id, sectionModuleId, sectionsCompleted, completed);

  await ctx.reply(completed ? "Module complete. Nicely done." : "Section marked complete.", Markup.inlineKeyboard([
    [Markup.button.callback("Back to Module", `${CP.module}${sectionModuleId}`), Markup.button.callback("Try Quiz", `${CP.quizModule}${sectionModuleId}`)],
  ]));
}

// ── Videos ──────────────────────────────────────────────────────────────────

async function sendVideos(ctx: BotContext, acharya: AcharyaSlug, learner: TelegramLearner, moduleId: string) {
  const lang = await getLang(ctx.from?.id);
  const mod = await getModuleById(acharya, moduleId);
  const videos = await loadVideos(acharya, moduleId);
  if (!videos.length) {
    await ctx.reply("No videos available yet.", Markup.inlineKeyboard([
      [Markup.button.url("Open Video Page", appLink(acharya, "/video"))],
    ]));
    return;
  }

  const lines = [`<b>Videos${mod ? `: ${escapeHtml(titleOf(mod, lang))}` : ""}</b>`];
  for (const v of videos) {
    const url = `https://www.youtube.com/watch?v=${v.youtube_id}${v.start_seconds ? `&t=${v.start_seconds}s` : ""}`;
    lines.push(`\n<b>${escapeHtml(titleOf(v, lang))}</b>${v.duration ? ` (${escapeHtml(v.duration)})` : ""}\n${url}`);
  }
  await ctx.reply(lines.join("\n"), {
    parse_mode: "HTML",
    ...Markup.inlineKeyboard([[Markup.button.url("Open Video Page", appLink(acharya, "/video"))]]),
  });
}

// ── Quiz ────────────────────────────────────────────────────────────────────

function fallbackQuiz(topic: string): QuizQuestion[] {
  return [
    { q: `What is the first useful step in ${topic}?`, options: ["Observe carefully", "Act immediately", "Ignore it", "Ask a stranger"], correct: 0, explanation: "Good observation helps choose the right action." },
    { q: "What should you check before starting work?", options: ["Local conditions", "Only time", "Nothing special", "Phone battery"], correct: 0, explanation: "Check tools, materials, and safety before starting." },
    { q: "Who can confirm serious technical advice locally?", options: ["A supervisor or expert", "Random rumor", "Only social media", "Nobody"], correct: 0, explanation: "Always verify with a qualified expert." },
    { q: "What habit helps reduce mistakes?", options: ["Keeping records", "Guessing", "Skipping checks", "Rushing"], correct: 0, explanation: "Records show what worked and what didn't." },
    { q: "How should a new practice be tested first?", options: ["Small trial", "Full scale", "Without checking", "In a hurry"], correct: 0, explanation: "Small trials reduce risk." },
  ];
}

async function generateQuiz(acharya: AcharyaSlug, moduleId: string, lang: Lang): Promise<{ moduleRow: ModuleRow | null; questions: QuizQuestion[] }> {
  const moduleRow = await getModuleById(acharya, moduleId);
  const topic = moduleRow ? titleOf(moduleRow, lang) : "this module";
  if (!model) return { moduleRow, questions: fallbackQuiz(topic) };

  const langInstruction = lang === "bn" ? "Write Bengali in Bengali script." : lang === "hi" ? "Write Hindi in Devanagari script." : "Write simple English.";
  const systemPrompt = getSystemPrompt(acharya);
  const prompt = `${systemPrompt}\n\nCreate a 5-question multiple-choice quiz for learners.\nTopic: ${topic}\nRules:\n- ${langInstruction}\n- Practical field knowledge only.\n- Return ONLY JSON:\n{"questions":[{"q":"...","options":["...","...","...","..."],"correct":0,"explanation":"..."}]}`;

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
  } catch {
    return { moduleRow, questions: fallbackQuiz(topic) };
  }
}

async function startQuiz(ctx: BotContext, acharya: AcharyaSlug, learner: TelegramLearner, moduleId: string) {
  if (!ctx.from?.id) return;
  await ctx.reply("Preparing quiz...");
  const lang = await getLang(ctx.from.id);
  const { questions } = await generateQuiz(acharya, moduleId, lang);
  const quiz: QuizState = { moduleId, lang, questions, idx: 0, score: 0 };
  await patchBotState(ctx.from.id, { quiz });
  await sendQuizQuestion(ctx, quiz);
}

async function sendQuizQuestion(ctx: BotContext, state: QuizState) {
  const q = state.questions[state.idx];
  const buttons = q.options.slice(0, 4).map((opt, i) => [
    Markup.button.callback(`${String.fromCharCode(65 + i)}. ${opt.slice(0, 48)}`, `${CP.quizAnswer}${i}`),
  ]);
  await ctx.reply(`<b>Question ${state.idx + 1}/${state.questions.length}</b>\n\n${escapeHtml(q.q)}`, {
    parse_mode: "HTML", ...Markup.inlineKeyboard(buttons),
  });
}

async function answerQuiz(ctx: BotContext, acharya: AcharyaSlug, learner: TelegramLearner, optIdx: number) {
  if (!ctx.from?.id) return;
  const state = (await getBotState(ctx.from.id)).quiz;
  if (!state) { await ctx.reply("Start a quiz from the Quiz menu."); return; }

  const q = state.questions[state.idx];
  const correct = optIdx === q.correct;
  if (correct) state.score += 1;
  state.idx += 1;

  await ctx.reply(`${correct ? "<b>Correct!</b>" : "<b>Incorrect.</b>"}\n\n${escapeHtml(q.explanation)}`, { parse_mode: "HTML" });

  if (state.idx < state.questions.length) {
    await patchBotState(ctx.from.id, { quiz: state });
    await sendQuizQuestion(ctx, state);
    return;
  }

  await patchBotState(ctx.from.id, { quiz: undefined });
  await logQuizAttempt(acharya, learner.id, state.moduleId, state.score, state.questions.length, state.questions);
  await ctx.reply(`Quiz complete.\nScore: ${state.score}/${state.questions.length}`, Markup.inlineKeyboard([
    [Markup.button.callback("Retake", `${CP.quizModule}${state.moduleId}`), Markup.button.url("Open Progress", appLink(acharya, "/progress"))],
  ]));
}

// ── Ask (AI Chat) ───────────────────────────────────────────────────────────

async function answerTextQuestion(ctx: BotContext, acharya: AcharyaSlug, learner: TelegramLearner, text: string) {
  if (!model) { await ctx.reply("My AI brain is offline. Please try again later."); return; }

  const started = Date.now();
  const lang = await getLang(ctx.from?.id);
  await ctx.sendChatAction("typing");

  const systemPrompt = getSystemPrompt(acharya);
  const prompt = `${systemPrompt}\n\nPreferred language code: ${lang}. Match the user's language when possible.\nUser says: ${text}`;

  const waitMessageText =
    lang === "hi" ? "मैं सोच रहा हूँ... कृपया प्रतीक्षा करें।" :
    lang === "bn" ? "আমি ভাবছি... দয়া করে অপেক্ষা করুন।" :
    "Thinking... Please wait, I am preparing your answer.";
  let tempMsg: any = null;

  try {
    tempMsg = await ctx.reply(waitMessageText);
    const result = await model.generateContent(prompt);
    const answer = result.response.text();
    await logChat(acharya, learner.id, lang, text, answer, Date.now() - started);
    await ctx.reply(answer, mainMenuKeyboard(acharya, typeof learner !== "undefined" ? (learner.preferred_lang || "en") : "en"));
  } catch (err) {
    console.error("Gemini AI error:", err);
    await ctx.reply("I could not answer that right now. Please try again.", mainMenuKeyboard(acharya, typeof learner !== "undefined" ? (learner.preferred_lang || "en") : "en"));
  } finally {
    if (tempMsg && ctx.chat?.id) {
      try {
        await ctx.telegram.deleteMessage(ctx.chat.id, tempMsg.message_id);
      } catch (err) {
        console.error("Failed to delete temp message", err);
      }
    }
  }
}

// ── Image Analysis ──────────────────────────────────────────────────────────

function mimeFromFileName(fileName?: string): string | null {
  const ext = fileName?.toLowerCase().split(".").pop();
  if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
  if (ext === "png") return "image/png";
  if (ext === "webp") return "image/webp";
  return null;
}

async function fetchTelegramFile(ctx: BotContext, fileId: string, fallbackMimeType = "image/jpeg") {
  const fileLink = await ctx.telegram.getFileLink(fileId);
  const response = await fetch(fileLink.href);
  if (!response.ok) throw new Error(`File fetch failed: HTTP ${response.status}`);
  const buffer = Buffer.from(await response.arrayBuffer());
  const contentType = response.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase();
  const mimeType = contentType && contentType.startsWith("image/") ? contentType : fallbackMimeType;
  if (buffer.length > 18 * 1024 * 1024) throw new Error("Image too large");
  return { buffer, mimeType };
}

async function analyzeImage(ctx: BotContext, acharya: AcharyaSlug, learner: TelegramLearner, fileId: string, fallbackMimeType = "image/jpeg") {
  const started = Date.now();
  try {
    if (!model) { await ctx.reply("My AI brain is offline."); return; }
    await ctx.sendChatAction("typing");
    const { buffer, mimeType } = await fetchTelegramFile(ctx, fileId, fallbackMimeType);
    const lang = await getLang(ctx.from?.id);
    const caption = ctx.message?.caption ? `\nCaption: ${ctx.message.caption}` : "";
    const systemPrompt = getSystemPrompt(acharya);
    const prompt = `${systemPrompt}\n\nAnalyze this image directly. Return practical findings and action steps. Preferred language code: ${lang}.${caption}`;

    const result = await model.generateContent([
      { inlineData: { data: buffer.toString("base64"), mimeType } },
      { text: prompt },
    ]);
    const answer = result.response.text().trim();
    await logChat(acharya, learner.id, lang, `[image: ${mimeType}]`, answer, Date.now() - started);
    await ctx.reply(answer || "I analyzed the image but got no useful response. Please try a clearer photo.", mainMenuKeyboard(acharya, typeof learner !== "undefined" ? (learner.preferred_lang || "en") : "en"));
  } catch {
    await ctx.reply("I could not analyze that image. Please send a clear, well-lit photo.", mainMenuKeyboard(acharya, typeof learner !== "undefined" ? (learner.preferred_lang || "en") : "en"));
  }
}

// ── Apply (Field Reports) — BUG-05 fix: analyze photos with Gemini ─────────

async function startApply(ctx: BotContext, acharya: AcharyaSlug, learner: TelegramLearner, moduleId: string) {
  if (!ctx.from?.id) return;
  const mod = await getModuleById(acharya, moduleId);
  const lang = await getLang(ctx.from.id);
  await patchBotState(ctx.from.id, { apply: { turns: [], moduleId } });
  await ctx.reply(
    `Field Apply started${mod ? ` for ${titleOf(mod, lang)}` : ""}.\n\nSend text, voice, or a photo. When finished, select Submit Progress or Cancel Apply.`,
    Markup.keyboard([
      ["Submit Progress", "Cancel Apply"]
    ]).resize()
  );
}

async function handleApplyText(ctx: BotContext, acharya: AcharyaSlug, learner: TelegramLearner, text: string): Promise<boolean> {
  if (!ctx.from?.id) return false;
  const state = (await getBotState(ctx.from.id)).apply;
  if (!state) return false;

  const trimmed = text.trim();
  if (/^(submit progress|submit|finish)$/i.test(trimmed)) {
    await submitApply(ctx, acharya, learner, state);
    await patchBotState(ctx.from.id, { apply: undefined });
    await sendHome(ctx, acharya, learner);
    return true;
  }

  if (/^(cancel apply|cancel)$/i.test(trimmed)) {
    await patchBotState(ctx.from.id, { apply: undefined });
    await ctx.reply("Field Apply cancelled.", Markup.removeKeyboard());
    await sendHome(ctx, acharya, learner);
    return true;
  }

  state.turns.push({ text: text.slice(0, 1000) });
  await patchBotState(ctx.from.id, { apply: state });
  await ctx.reply(
    "Added to your report. Send next text/photo/voice, or select Submit Progress / Cancel Apply",
    Markup.keyboard([
      ["Submit Progress", "Cancel Apply"]
    ]).resize()
  );
  return true;
}

/**
 * BUG-05 fix: When a photo is submitted during Field Apply, analyze it with
 * Gemini to extract a brief description. This description is stored alongside
 * the turn text so the scoring prompt has visibility into what was photographed.
 */
async function addApplyPhoto(ctx: BotContext, acharya: AcharyaSlug, learner: TelegramLearner): Promise<boolean> {
  if (!ctx.from?.id) return false;
  const state = (await getBotState(ctx.from.id)).apply;
  if (!state) return false;

  const caption = ctx.message?.caption || "Photo attached";
  let photoDescription = caption;

  // Analyze the photo with Gemini for validation and description
  const photo = ctx.message?.photo?.[(ctx.message.photo.length || 1) - 1];
  if (photo && model) {
    try {
      await ctx.sendChatAction("typing");
      const { buffer, mimeType } = await fetchTelegramFile(ctx, photo.file_id);
      const systemPrompt = getSystemPrompt(acharya);
      const result = await model.generateContent([
        { inlineData: { data: buffer.toString("base64"), mimeType } },
        { text: `${systemPrompt}\n\nBriefly describe this field photo in 1-2 sentences for a progress report. Focus on what is visible: crop condition, work done, tools used, etc. If the image is not relevant to field work, note that. Reply in English.` },
      ]);
      const analysis = result.response.text().trim();
      if (analysis) {
        photoDescription = `[Photo: ${analysis}] ${caption}`;
      }
    } catch {
      // If analysis fails, keep the caption as-is
    }
  }

  state.turns.push({ text: photoDescription.slice(0, 1500), hasPhoto: true });
  await patchBotState(ctx.from.id, { apply: state });
  await ctx.reply(
    "Photo added to your report. Send next text/photo/voice, or select Submit Progress / Cancel Apply",
    Markup.keyboard([
      ["Submit Progress", "Cancel Apply"]
    ]).resize()
  );
  return true;
}

async function submitApply(ctx: BotContext, acharya: AcharyaSlug, learner: TelegramLearner, state: ApplyState) {
  const lang = await getLang(ctx.from?.id);
  const input = state.turns.map((t, i) => `${i + 1}. ${t.text}${t.hasPhoto ? " (photo)" : ""}`).join("\n").slice(0, 5000);
  if (!input) { await ctx.reply("Send at least one field update before submitting."); return; }

  let parsed = { summary: input.slice(0, 120), score: 6, feedback: "Good start. Add more details next time.", nextStep: "Observe and record one concrete action." };
  if (model) {
    try {
      const systemPrompt = getSystemPrompt(acharya);
      const prompt = `${systemPrompt}\n\nEvaluate this field report. Return ONLY JSON:\n{"summary":"one-line summary","score":7,"feedback":"2 short specific sentences","nextStep":"one practical next step"}\nScore 1-10. Consider photo evidence as positive. Penalize if photos are irrelevant to the topic. Reply language code: ${lang}.\nReport:\n${input}`;
      const result = await model.generateContent({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: "application/json", maxOutputTokens: 700 },
      });
      parsed = { ...parsed, ...JSON.parse(result.response.text()) };
    } catch { /* use fallback */ }
  }

  const score = Math.max(0, Math.min(10, Number(parsed.score) || 6));
  await logApply(acharya, learner.id, state.moduleId, {
    log_type: "self_assessment",
    data: { input, score, feedback: parsed.feedback, nextStep: parsed.nextStep },
  });

  await ctx.reply(
    `<b>Score: ${score}/10</b>\n\n${escapeHtml(parsed.summary)}\n\n<b>Feedback</b>\n${escapeHtml(parsed.feedback)}\n\n<b>Next step</b>\n${escapeHtml(parsed.nextStep)}`,
    { parse_mode: "HTML", ...Markup.inlineKeyboard([[Markup.button.url("Open Apply Page", appLink(acharya, "/apply"))]]) },
  );
}

// ── Tools (Farmer only) ─────────────────────────────────────────────────────

async function sendTools(ctx: BotContext, acharya: AcharyaSlug) {
  if (acharya !== "farmer") {
    await ctx.reply("Tools are specific to each Acharya. Use Ask to get guidance.");
    return;
  }
  await ctx.reply("<b>Farm Tools</b>\nChoose a tool:", {
    parse_mode: "HTML",
    ...Markup.inlineKeyboard([
      [Markup.button.callback("Weather", `${CP.tool}weather`), Markup.button.callback("Mandi Prices", `${CP.tool}mandi`)],
      [Markup.button.callback("Crop Calendar", `${CP.tool}calendar`), Markup.button.callback("Fertilizer Calculator", `${CP.tool}fertilizer`)],
      [Markup.button.callback("Farm Diary", `${CP.tool}diary`), Markup.button.url("Open Tools Page", appLink(acharya, "/tools"))],
    ]),
  });
}

async function handleToolAction(ctx: BotContext, acharya: AcharyaSlug, learner: TelegramLearner, tool: string) {
  if (!ctx.from?.id) return;
  await patchBotState(ctx.from.id, { tool: undefined });
  if (tool === "weather") {
    await patchBotState(ctx.from.id, { tool: { kind: "weather" } });
    await ctx.reply("Send location as: Weather Kolkata\nFor default Kolkata forecast, type: Weather");
  } else if (tool === "mandi") {
    await patchBotState(ctx.from.id, { tool: { kind: "mandi" } });
    await ctx.reply("Send crop and optional state as: Mandi Wheat Punjab\nOr: Mandi Paddy");
  } else if (tool === "calendar") {
    await ctx.reply("<b>Crop Calendar</b>\n1. Seed/Nursery - prepare seed and records.\n2. Sowing - sow at recommended spacing.\n3. Irrigation + nutrients - track water, weeds and pests.\n4. Harvest + selling - grade, store, compare markets.", { parse_mode: "HTML" });
  } else if (tool === "fertilizer") {
    await patchBotState(ctx.from.id, { tool: { kind: "fertilizer" } });
    await ctx.reply("Send: Fertilizer area N P K\nExample: Fertilizer 2 40 20 20");
  } else if (tool === "diary") {
    await patchBotState(ctx.from.id, { tool: { kind: "diary", step: "crop" } });
    await ctx.reply("Farm diary: what crop?");
  }
}

async function handleToolText(ctx: BotContext, acharya: AcharyaSlug, learner: TelegramLearner, text: string): Promise<boolean> {
  if (!ctx.from?.id) return false;
  const lower = text.toLowerCase();
  const state = (await getBotState(ctx.from.id)).tool;
  if (!state && !lower.startsWith("weather") && !lower.startsWith("mandi") && !lower.startsWith("price") && !lower.startsWith("fertilizer")) return false;

  if (state?.kind === "diary") {
    await handleDiaryStep(ctx, acharya, learner, state, text);
    return true;
  }

  if (state?.kind === "fertilizer" || lower.startsWith("fertilizer")) {
    const nums = text.replace(/^fertilizer/i, "").trim().split(/\s+/).map(Number).filter(Number.isFinite);
    if (nums.length < 4) { await ctx.reply("Send: Fertilizer area N P K\nExample: Fertilizer 2 40 20 20"); return true; }
    const [area, n, p, k] = nums;
    const urea = Math.round((n * area) / 0.46);
    const dap = Math.round((p * area) / 0.46);
    const mop = Math.round((k * area) / 0.60);
    await patchBotState(ctx.from.id, { tool: undefined });
    await ctx.reply(`Fertilizer estimate for ${area} acres:\nUrea: ${urea} kg\nDAP: ${dap} kg\nMOP: ${mop} kg\n\nUse only for planning. Final dose should follow soil test and local KVK advice.`);
    return true;
  }

  if (state?.kind === "weather" || lower.startsWith("weather")) {
    await patchBotState(ctx.from.id, { tool: undefined });
    await sendWeather(ctx, text.replace(/^weather/i, "").trim());
    return true;
  }

  if (state?.kind === "mandi" || lower.startsWith("mandi") || lower.startsWith("price")) {
    await patchBotState(ctx.from.id, { tool: undefined });
    await sendMandi(ctx, text.replace(/^(mandi|price)/i, "").trim());
    return true;
  }

  return false;
}

async function sendWeather(ctx: BotContext, query: string) {
  const coords = cityCoords(query);
  const qs = new URLSearchParams({
    latitude: String(coords.lat), longitude: String(coords.lon),
    daily: "temperature_2m_max,temperature_2m_min,precipitation_sum,wind_speed_10m_max",
    timezone: "auto", forecast_days: "5",
  });
  try {
    const res = await fetch(`https://api.open-meteo.com/v1/forecast?${qs}`);
    const data = await res.json();
    const daily = data.daily || {};
    const lines = [`<b>Weather: ${escapeHtml(coords.label)}</b>`];
    for (let i = 0; i < Math.min(5, daily.time?.length || 0); i++) {
      lines.push(`${daily.time[i]}: ${daily.temperature_2m_min?.[i] ?? "-"}-${daily.temperature_2m_max?.[i] ?? "-"} C, rain ${daily.precipitation_sum?.[i] ?? 0} mm`);
    }
    lines.push("\nTip: avoid spraying before rain or strong wind.");
    await ctx.reply(lines.join("\n"), { parse_mode: "HTML" });
  } catch { await ctx.reply("Weather service unavailable. Try again later."); }
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
    await ctx.reply(`Live mandi prices need DATA_GOV_API_KEY.\n\nQuery: ${commodity}${state ? `, ${state}` : ""}`);
    return;
  }
  const qs = new URLSearchParams({ "api-key": apiKey, format: "json", limit: "5", "filters[commodity]": commodity });
  if (state) qs.set("filters[state]", state);
  try {
    const res = await fetch(`https://api.data.gov.in/resource/9ef84268-d588-465a-a308-a864a43d0070?${qs}`);
    const data = await res.json();
    const records = Array.isArray(data.records) ? data.records : [];
    if (!records.length) { await ctx.reply("No mandi records found. Try another crop or state."); return; }
    const lines = [`<b>Mandi prices: ${escapeHtml(commodity)}</b>`];
    for (const r of records.slice(0, 5) as Array<Record<string, string>>) {
      lines.push(`${r.state || ""} ${r.market || "-"}: Rs ${r.modal_price || "-"} (${r.arrival_date || ""})`);
    }
    await ctx.reply(lines.join("\n"), { parse_mode: "HTML" });
  } catch { await ctx.reply("Could not load mandi prices. Try again later."); }
}

async function handleDiaryStep(ctx: BotContext, acharya: AcharyaSlug, learner: TelegramLearner, state: Extract<ToolState, { kind: "diary" }>, text: string) {
  if (!ctx.from?.id) return;
  if (state.step === "crop") {
    await patchBotState(ctx.from.id, { tool: { ...state, crop: text.slice(0, 120), step: "activity" } });
    await ctx.reply("What activity did you do?");
  } else if (state.step === "activity") {
    await patchBotState(ctx.from.id, { tool: { ...state, activity: text.slice(0, 160), step: "expense" } });
    await ctx.reply("Expense amount? Send 0 if none.");
  } else if (state.step === "expense") {
    const expense = Number(text.replace(/[^\d.]/g, "")) || 0;
    await patchBotState(ctx.from.id, { tool: { ...state, expense, step: "notes" } });
    await ctx.reply("Any notes? Send '-' if none.");
  } else {
    const notes = text === "-" ? "" : text.slice(0, 1000);
    await logDiary(acharya, learner.id, { crop: state.crop || "", activity: state.activity || "Field activity", expense: state.expense || 0, notes });
    await patchBotState(ctx.from.id, { tool: undefined });
    await ctx.reply("Diary entry saved.");
  }
}

// ── Progress ────────────────────────────────────────────────────────────────

async function sendProgress(ctx: BotContext, acharya: AcharyaSlug, learner: TelegramLearner) {
  const modules = await loadModules(acharya);
  const summary = await progressSummary(acharya, learner.id);
  const lines = [
    "<b>My Progress</b>",
    `Modules completed: <b>${summary.completedModules}/${modules.length}</b>`,
    `Quizzes: <b>${summary.quizCount}</b>`,
    `Average score: <b>${summary.avgScore}%</b>`,
  ];
  await ctx.reply(lines.join("\n"), {
    parse_mode: "HTML",
    ...Markup.inlineKeyboard([[Markup.button.url("Open Progress Page", appLink(acharya, "/progress"))]]),
  });
}

// ── Voice Transcription (BUG-03 fix) ───────────────────────────────────────
//
// Telegram sends voice messages as .oga files (Opus codec in OGG container).
// We detect the actual Content-Type from the download response and pass it
// to Gemini. Gemini supports audio/ogg, audio/mpeg, audio/wav, etc.

async function transcribeVoice(ctx: BotContext): Promise<string | null> {
  if (!model || !ctx.message?.voice) return null;

  try {
    const fileLink = await ctx.telegram.getFileLink(ctx.message.voice.file_id);
    const response = await fetch(fileLink.href);
    if (!response.ok) return null;

    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.length > 20 * 1024 * 1024) return null; // 20 MB limit

    // Detect MIME type from response headers, default to audio/ogg for Telegram .oga files
    const contentType = response.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase();
    const mimeType = contentType && contentType.startsWith("audio/") ? contentType : "audio/ogg";

    const result = await model.generateContent([
      { text: "Transcribe this voice message. Return only the spoken text in the same language. If you cannot understand the audio, return 'UNCLEAR'." },
      { inlineData: { data: buffer.toString("base64"), mimeType } },
    ]);

    const text = result.response.text().trim();
    if (!text || text === "UNCLEAR") return null;
    return text;
  } catch (err) {
    console.error("Voice transcription error:", err);
    return null;
  }
}

// ── Telegraf Bot Setup ──────────────────────────────────────────────────────

if (bot) {
  // Navigation reset middleware
  bot.use(async (ctx, next) => {
    const text = (ctx.message as any)?.text?.trim();
    const fromId = ctx.from?.id;
    if (fromId && text) {
      const menuTexts = [
        "Home", "Learn Modules", "Videos", "Quiz", "Field Apply", "My Progress", "Farm Tools", "Open Website", "Language", "Change Acharya", "Logout",
        "Ask Farmer Acharya", "Ask Vajra Acharya", "Ask Taksha Acharya"
      ];
      if (menuTexts.includes(text)) {
        const state = await getBotState(fromId);
        if (state.apply || state.ask || state.tool || state.quiz) {
          await patchBotState(fromId, { apply: undefined, ask: undefined, tool: undefined, quiz: undefined });
        }
      }
    }
    return next();
  });

  bot.start(async (ctx) => {
    const fromId = ctx.from?.id;
    if (!fromId) return;

    // Reset session to ensure they authenticate whenever starting fresh
    await deleteSession(fromId);
    await promptAuthentication(ctx);
  });

  bot.command("login", async (ctx) => {
    const fromId = ctx.from?.id;
    if (!fromId) return;
    const session = await getSessionForUser(fromId);
    const phone = session.state_json?.authenticatedPhone;
    if (!phone) {
      await promptAuthentication(ctx);
      return;
    }
    if (session.acharya_slug) {
      await loginWithPhone(ctx, session.acharya_slug, phone);
    } else {
      await showAcharyaPicker(ctx);
    }
  });

  bot.hears("Type phone number", async (ctx) => ctx.reply("Type your 10-digit Indian mobile number."));

  bot.hears(Object.values(MENU_LABELS.changeAcharya), async (ctx) => {
    if (ctx.from?.id) {
      const session = await getSessionForUser(ctx.from.id);
      const phone = session.state_json?.authenticatedPhone;
      await saveSession({
        ...session,
        acharya_slug: null,
        learner_id: null,
        state_json: { authenticatedPhone: phone },
      });
    }
    await showAcharyaPicker(ctx);
  });

  bot.hears(Object.values(MENU_LABELS.logout), async (ctx) => {
    if (ctx.from?.id) {
      const acharya = await getAcharya(ctx.from.id);
      if (acharya) {
        await unlinkTelegramUser(acharya, ctx.from.id);
      }
      await deleteSession(ctx.from.id);
    }
    await ctx.reply("You have been logged out.", Markup.removeKeyboard());
    await promptAuthentication(ctx);
  });

  bot.command("logout", async (ctx) => {
    if (ctx.from?.id) {
      const acharya = await getAcharya(ctx.from.id);
      if (acharya) {
        await unlinkTelegramUser(acharya, ctx.from.id);
      }
      await deleteSession(ctx.from.id);
    }
    await ctx.reply("You have been logged out.", Markup.removeKeyboard());
    await promptAuthentication(ctx);
  });

  // Acharya selection callback
  bot.action(/^ach:(farmer|vajra|taksha)$/, async (ctx) => {
    await ctx.answerCbQuery();
    const fromId = ctx.from?.id;
    if (!fromId) return;

    const session = await getSessionForUser(fromId);
    const phone = session.state_json?.authenticatedPhone;
    if (!phone) {
      await promptAuthentication(ctx);
      return;
    }

    await setAcharya(ctx, ctx.match[1] as AcharyaSlug);
  });

  // Contact sharing
  bot.on("contact", async (ctx) => {
    const fromId = ctx.from?.id;
    if (!fromId) return;
    const contact = ctx.message?.contact;
    if (!contact) return;
    if (contact.user_id && contact.user_id !== fromId) {
      await ctx.reply("Please share your own Telegram phone number.");
      return;
    }
    await authenticateUserWithPhone(ctx, contact.phone_number);
  });

  // Helper: get learner with acharya
  async function requireLearner(ctx: BotContext): Promise<{ acharya: AcharyaSlug; learner: TelegramLearner } | null> {
    const fromId = ctx.from?.id;
    if (!fromId) return null;
    const session = await getSessionForUser(fromId);
    const phone = session.state_json?.authenticatedPhone;
    if (!phone) {
      if (session.state_json?.pendingPhone) {
        await ctx.reply("Please enter the OTP to continue. (Pilot OTP: 123456)");
      } else {
        await promptAuthentication(ctx);
      }
      return null;
    }
    if (!session.acharya_slug) {
      await showAcharyaPicker(ctx);
      return null;
    }
    const learner = await getTelegramLearner(session.acharya_slug, fromId);
    if (!learner) {
      const name = telegramName(ctx.from!);
      const newLearner = await upsertTelegramUser(
        session.acharya_slug,
        fromId,
        ctx.chat!.id,
        phone,
        name,
        ctx.from!.username || null,
        session.preferred_lang || "en",
      );
      if (newLearner) {
        await patchSession(fromId, { learner_id: newLearner.id });
        return { acharya: session.acharya_slug, learner: newLearner };
      }
      await ctx.reply("Please login with your phone number first.", phoneKeyboard());
      return null;
    }
    return { acharya: session.acharya_slug, learner };
  }

  // Menu handlers
  bot.hears(Object.values(MENU_LABELS.home), async (ctx) => {
    const result = await requireLearner(ctx);
    if (result) await sendHome(ctx, result.acharya, result.learner);
  });

  bot.hears(Object.values(MENU_LABELS.learnModules), async (ctx) => {
    const result = await requireLearner(ctx);
    if (result) await sendModuleList(ctx, result.acharya, result.learner, 0, "learn");
  });

  bot.hears(Object.values(MENU_LABELS.videos), async (ctx) => {
    const result = await requireLearner(ctx);
    if (result) await sendModuleList(ctx, result.acharya, result.learner, 0, "videos");
  });

  bot.hears(Object.values(MENU_LABELS.quiz), async (ctx) => {
    const result = await requireLearner(ctx);
    if (result) await sendModuleList(ctx, result.acharya, result.learner, 0, "quiz");
  });

  bot.hears(Object.values(MENU_LABELS.fieldApply), async (ctx) => {
    const result = await requireLearner(ctx);
    if (result) await sendModuleList(ctx, result.acharya, result.learner, 0, "apply");
  });

  bot.hears(Object.values(MENU_LABELS.myProgress), async (ctx) => {
    const result = await requireLearner(ctx);
    if (result) await sendProgress(ctx, result.acharya, result.learner);
  });

  bot.hears(Object.values(MENU_LABELS.askFarmer), async (ctx) => {
    const result = await requireLearner(ctx);
    if (result && ctx.from?.id) {
      await patchBotState(ctx.from.id, { ask: true });
      await ctx.reply("Ask me by typing a question, recording a voice message, or sending a photo.", askKeyboard());
    }
  });

  bot.hears(Object.values(MENU_LABELS.askVajra), async (ctx) => {
    const result = await requireLearner(ctx);
    if (result && ctx.from?.id) {
      await patchBotState(ctx.from.id, { ask: true });
      await ctx.reply("Ask me by typing a question, recording a voice message, or sending a photo.", askKeyboard());
    }
  });

  bot.hears(Object.values(MENU_LABELS.askTaksha), async (ctx) => {
    const result = await requireLearner(ctx);
    if (result && ctx.from?.id) {
      await patchBotState(ctx.from.id, { ask: true });
      await ctx.reply("Ask me by typing a question, recording a voice message, or sending a photo.", askKeyboard());
    }
  });

  bot.hears(Object.values(MENU_LABELS.farmTools), async (ctx) => {
    const result = await requireLearner(ctx);
    if (result) await sendTools(ctx, result.acharya);
  });

  bot.hears(Object.values(MENU_LABELS.openWebsite), async (ctx) => {
    const result = await requireLearner(ctx);
    if (result) {
      await ctx.reply(`Open ${ACHARYA_NAMES[result.acharya]} website:`, Markup.inlineKeyboard([
        [Markup.button.url("Open Website", appLink(result.acharya, "/"))],
      ]));
    }
  });

  bot.hears(Object.values(MENU_LABELS.language), async (ctx) => {
    const result = await requireLearner(ctx);
    if (result) {
      await ctx.reply("Choose your preferred language:", Markup.inlineKeyboard([
        [Markup.button.callback("English", "lang_en")],
        [Markup.button.callback("Hindi", "lang_hi")],
        [Markup.button.callback("Bengali", "lang_bn")],
      ]));
    }
  });

  // Language callback — persist to DB session
  bot.action(/^lang_(en|hi|bn)$/, async (ctx) => {
    const result = await requireLearner(ctx);
    if (!result) return;
    const lang = ctx.match[1] as Lang;
    if (ctx.from?.id) {
      await patchSession(ctx.from.id, { preferred_lang: lang });
    }
    await ctx.answerCbQuery();
    await ctx.deleteMessage();
    
    let msg = `Language set to English.`;
    if (lang === "hi") msg = "भाषा हिंदी में सेट हो गई है।";
    if (lang === "bn") msg = "ভাষা বাংলায় সেট করা হয়েছে।";
    
    await ctx.reply(msg, mainMenuKeyboard(result.acharya, lang));
  });

  // Module list pagination
  bot.action(/^mods:(learn|videos|quiz|apply):(\d+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    const result = await requireLearner(ctx);
    if (result) await sendModuleList(ctx, result.acharya, result.learner, Number(ctx.match[2]), ctx.match[1] as "learn" | "videos" | "quiz" | "apply");
  });

  // Module details
  bot.action(/^mod:(.+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    const result = await requireLearner(ctx);
    if (result) await sendModuleDetails(ctx, result.acharya, result.learner, ctx.match[1]);
  });

  // Section view
  bot.action(/^sec:(.+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    const result = await requireLearner(ctx);
    if (result) await sendSection(ctx, result.acharya, result.learner, ctx.match[1]);
  });

  // Mark complete
  bot.action(/^done:(.+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    const result = await requireLearner(ctx);
    if (result) await completeSection(ctx, result.acharya, result.learner, ctx.match[1]);
  });

  // Videos
  bot.action(/^vids:(.+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    const result = await requireLearner(ctx);
    if (result) await sendVideos(ctx, result.acharya, result.learner, ctx.match[1]);
  });

  // Start quiz
  bot.action(/^qmod:(.+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    const result = await requireLearner(ctx);
    if (result) await startQuiz(ctx, result.acharya, result.learner, ctx.match[1]);
  });

  // Answer quiz
  bot.action(/^qa:(\d+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    const result = await requireLearner(ctx);
    if (result) await answerQuiz(ctx, result.acharya, result.learner, Number(ctx.match[1]));
  });

  // Start apply
  bot.action(/^apmod:(.+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    const result = await requireLearner(ctx);
    if (result) await startApply(ctx, result.acharya, result.learner, ctx.match[1]);
  });

  // Tool actions
  bot.action(/^tool:(weather|mandi|calendar|fertilizer|diary)$/, async (ctx) => {
    await ctx.answerCbQuery();
    const result = await requireLearner(ctx);
    if (result) await handleToolAction(ctx, result.acharya, result.learner, ctx.match[1]);
  });

  // Voice messages (BUG-03 fix: improved transcription pipeline)
  bot.on("voice", async (ctx) => {
    const result = await requireLearner(ctx);
    if (!result || !ctx.from?.id) return;

    const session = await getSessionForUser(ctx.from.id);
    const state = session.state_json || {};

    const isApply = !!state.apply;
    const isAsk = !!state.ask;

    if (!isApply && !isAsk) {
      await sendDefaultMessage(ctx, result.acharya, session.preferred_lang || "en");
      return;
    }

    try {
      await ctx.sendChatAction("typing");
      const transcript = await transcribeVoice(ctx);
      if (!transcript) { await ctx.reply("I could not understand that voice message. Please try again."); return; }

      if (isApply) {
        const applyState = state.apply!;
        applyState.turns.push({ text: transcript });
        await patchBotState(ctx.from.id, { apply: applyState });
        await ctx.reply(
          `Added voice note: "${transcript}"\n\nSend next text/photo/voice, or select Submit Progress / Cancel Apply`,
          Markup.keyboard([
            ["Submit Progress", "Cancel Apply"]
          ]).resize()
        );
        return;
      }

      if (isAsk) {
        if (!model) { await ctx.reply("My AI brain is offline."); return; }

        const started = Date.now();
        const lang = session.preferred_lang || "en";

        const waitMessageText =
          lang === "hi" ? "मैं सोच रहा हूँ... कृपया प्रतीक्षा करें।" :
          lang === "bn" ? "আমি ভাবছি... দয়া করে অপেক্ষা করুন।" :
          "Thinking... Please wait, I am preparing your answer.";
        let tempMsg: any = null;

        try {
          tempMsg = await ctx.reply(waitMessageText);
          const systemPrompt = getSystemPrompt(result.acharya);
          const prompt = `${systemPrompt}\n\nAnswer this transcribed voice message in under 150 words. Preferred language: ${lang}.\nMessage: ${transcript}`;
          const answer = (await model.generateContent(prompt)).response.text();
          await logChat(result.acharya, result.learner.id, lang, `[voice] ${transcript}`, answer, Date.now() - started);
          await ctx.reply(answer, mainMenuKeyboard(result.acharya, (result.learner?.preferred_lang || "en")));
        } finally {
          await patchBotState(ctx.from.id, { ask: undefined });
          if (tempMsg && ctx.chat?.id) {
            try {
              await ctx.telegram.deleteMessage(ctx.chat.id, tempMsg.message_id);
            } catch (err) {
              console.error("Failed to delete temp message", err);
            }
          }
        }
      }
    } catch (err) {
      console.error("Voice handler error:", err);
      await ctx.reply("I could not process that voice message. Please try typing your question instead.", mainMenuKeyboard(result.acharya, (result.learner?.preferred_lang || "en")));
    }
  });

  // Photo messages (BUG-05: updated addApplyPhoto signature)
  bot.on("photo", async (ctx) => {
    const result = await requireLearner(ctx);
    if (!result || !ctx.from?.id) return;

    const session = await getSessionForUser(ctx.from.id);
    const state = session.state_json || {};

    const isApply = !!state.apply;
    const isAsk = !!state.ask;

    if (!isApply && !isAsk) {
      await sendDefaultMessage(ctx, result.acharya, session.preferred_lang || "en");
      return;
    }

    if (isApply) {
      await addApplyPhoto(ctx, result.acharya, result.learner);
      return;
    }

    if (isAsk) {
      const photo = ctx.message?.photo?.[(ctx.message.photo.length || 1) - 1];
      if (!photo) { await ctx.reply("Please send a clear photo.", mainMenuKeyboard(result.acharya, (result.learner?.preferred_lang || "en"))); return; }
      try {
        await analyzeImage(ctx, result.acharya, result.learner, photo.file_id);
      } finally {
        await patchBotState(ctx.from.id, { ask: undefined });
      }
    }
  });

  // Document messages (BUG-05: updated addApplyPhoto signature)
  bot.on("document", async (ctx) => {
    const result = await requireLearner(ctx);
    if (!result || !ctx.from?.id) return;

    const session = await getSessionForUser(ctx.from.id);
    const state = session.state_json || {};

    const isApply = !!state.apply;
    const isAsk = !!state.ask;

    if (!isApply && !isAsk) {
      await sendDefaultMessage(ctx, result.acharya, session.preferred_lang || "en");
      return;
    }

    if (isApply) {
      await addApplyPhoto(ctx, result.acharya, result.learner);
      return;
    }

    if (isAsk) {
      const doc = ctx.message?.document;
      const mimeType = doc?.mime_type || mimeFromFileName(doc?.file_name);
      if (!doc || !mimeType?.startsWith("image/")) {
        await ctx.reply("Please send an image file, or use Telegram's photo option.", mainMenuKeyboard(result.acharya, (result.learner?.preferred_lang || "en")));
        return;
      }
      try {
        await analyzeImage(ctx, result.acharya, result.learner, doc.file_id, mimeType);
      } finally {
        await patchBotState(ctx.from.id, { ask: undefined });
      }
    }
  });

  // Text messages (catch-all)
  bot.on("text", async (ctx) => {
    const text = ctx.message?.text?.trim();
    if (!text) return;

    // Skip menu texts
    const menuTexts = [
      ...Object.values(MENU_LABELS).flatMap(l => Object.values(l)),
      "Type phone number", "Cancel Ask", "Cancel Apply"
    ];
    if (menuTexts.includes(text)) return;

    const fromId = ctx.from?.id;
    if (!fromId) return;

    // 1. Check if user is authenticated with a phone number
    const session = await getSessionForUser(fromId);
    const phone = session.state_json?.authenticatedPhone;

    if (!phone) {
      // Check if awaiting OTP
      if (session.state_json?.pendingPhone) {
        if (text === "123456") {
          const pPhone = session.state_json.pendingPhone;
          await patchBotState(fromId, { authenticatedPhone: pPhone, pendingPhone: undefined });
          await ctx.reply(`Authentication successful! Phone registered: ${pPhone}`, Markup.removeKeyboard());

          if (session.acharya_slug) {
            await loginWithPhone(ctx, session.acharya_slug, pPhone);
          } else {
            await showAcharyaPicker(ctx);
          }
          return;
        } else {
          const typedPhone = normalizeIndianPhone(text);
          if (typedPhone) {
            await authenticateUserWithPhone(ctx, typedPhone);
            return;
          }
          await ctx.reply("Invalid OTP. Please try again. (Pilot OTP: 123456)");
          return;
        }
      }

      // If not authenticated, check if the typed text is a phone number
      const typedPhone = normalizeIndianPhone(text);
      if (typedPhone) {
        await authenticateUserWithPhone(ctx, typedPhone);
        return;
      }
      // Otherwise, prompt them to authenticate first
      await promptAuthentication(ctx);
      return;
    }

    // 2. If authenticated but no Acharya is selected, show Acharya picker
    if (!session.acharya_slug) {
      await showAcharyaPicker(ctx);
      return;
    }

    // 3. Ensure they have a learner record (self-healing lookup/upsert)
    const result = await requireLearner(ctx);
    if (!result) return;
    const { acharya, learner } = result;

    // Check if this is a phone number being typed again
    const typedPhone = normalizeIndianPhone(text);
    if (typedPhone) {
      await authenticateUserWithPhone(ctx, typedPhone);
      return;
    }

    const state = session.state_json || {};

    // Handle Cancel Ask
    if (state.ask && /^(cancel ask|cancel)$/i.test(text)) {
      await patchBotState(fromId, { ask: undefined });
      await ctx.reply("Ask mode cancelled.", Markup.removeKeyboard());
      await sendHome(ctx, acharya, learner);
      return;
    }

    // Try apply text handler
    if (await handleApplyText(ctx, acharya, learner, text)) return;

    // Try tool text handler (farmer only)
    if (acharya === "farmer" && await handleToolText(ctx, acharya, learner, text)) return;

    // If they are in ask mode, answer their question
    if (state.ask) {
      try {
        await answerTextQuestion(ctx, acharya, learner, text);
      } catch {
        await ctx.reply("I could not answer that right now. Please try again.", mainMenuKeyboard(acharya, typeof learner !== "undefined" ? (learner.preferred_lang || "en") : "en"));
      } finally {
        await patchBotState(fromId, { ask: undefined });
      }
      return;
    }

    // If they are not in ask or apply (or tool) mode, return default message!
    await sendDefaultMessage(ctx, acharya, session.preferred_lang || "en");
  });
}

// ── Route Handlers ──────────────────────────────────────────────────────────

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
    ai: aiApiKey ? "Configured" : "Missing GEMINI_API_KEY",
    databases: {
      farmer: isDbConfigured("farmer") ? "Configured" : "Missing FARMER_SUPABASE_URL",
      vajra: isDbConfigured("vajra") ? "Configured" : "Missing SUPABASE_URL",
      taksha: isDbConfigured("taksha") ? "Configured" : "Missing TAKSHA_SUPABASE_URL",
    },
    acharyas: ["farmer", "vajra", "taksha"],
  });
}
