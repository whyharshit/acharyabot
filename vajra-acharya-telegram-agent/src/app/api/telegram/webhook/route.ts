import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { Context, Markup, Telegraf } from "telegraf";
import { normalizeIndianPhone } from "@/lib/phone";
import { AcharyaSlug, ACHARYA_NAMES, getSystemPrompt } from "@/lib/system-prompts";
import {
  dbConfigured, type Lang, type TelegramLearner, type ModuleRow, type SectionRow, type VideoRow,
  type QuizQuestion, type QuizState, type ToolState, type ApplyState, type BotState,
  ACHARYA_TABLE_CONFIG, acharyaTable,
  getTelegramLearner, upsertTelegramUser, loadModules, getModuleById, loadSections, loadVideos,
  getProgress, upsertProgress, progressSummary, logChat, logQuizAttempt, logApply, logDiary, logEvent,
  recentModuleForLearner, titleOf, bodyOf, telegramName,
} from "@/lib/server/supabase";

export const runtime = "nodejs";
export const preferredRegion = "bom1";
export const maxDuration = 60;

// ── Types ───────────────────────────────────────────────────────────────────

type TelegramFrom = { id: number; first_name?: string; last_name?: string; username?: string };
type BotContext = Context & {
  from?: TelegramFrom; chat?: { id: number }; match?: RegExpExecArray;
  message?: { text?: string; caption?: string; contact?: { phone_number: string; user_id?: number }; voice?: { file_id: string }; photo?: Array<{ file_id: string }>; document?: { file_id: string; mime_type?: string; file_name?: string } };
};
type InlineButton = ReturnType<typeof Markup.button.callback> | ReturnType<typeof Markup.button.url>;

// ── AI Setup ────────────────────────────────────────────────────────────────

const botToken = process.env.TELEGRAM_BOT_TOKEN;
const bot = botToken ? new Telegraf(botToken) : null;
const aiApiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
const genAI = aiApiKey ? new GoogleGenerativeAI(aiApiKey) : null;
const model = genAI ? genAI.getGenerativeModel({ model: "gemini-2.5-flash" }) : null;

// ── App URLs ────────────────────────────────────────────────────────────────

const APP_URLS: Record<AcharyaSlug, string> = {
  farmer: process.env.FARMER_APP_URL || "https://farmer-acharya-app.vercel.app",
  vajra: process.env.VAJRA_APP_URL || "https://vajra-acharya.vercel.app",
  taksha: process.env.TAKSHA_APP_URL || "https://taksha-acharya.vercel.app",
};

// ── In-memory state ─────────────────────────────────────────────────────────

const userAcharyas = new Map<number, AcharyaSlug>();
const userLangs = new Map<number, Lang>();
const userBotStates = new Map<string, BotState>();
const MODULE_PAGE_SIZE = 8;

// ── Callback prefixes ───────────────────────────────────────────────────────

const CP = { acharya: "ach:", modules: "mods:", module: "mod:", section: "sec:", complete: "done:", videos: "vids:", quizModule: "qmod:", quizAnswer: "qa:", applyModule: "apmod:", tool: "tool:" } as const;

// ── Chat History ────────────────────────────────────────────────────────────

async function getChatHistory(acharya: AcharyaSlug, learnerId: string): Promise<Array<{ role: "user" | "model"; parts: Array<{ text: string }> }>> {
  const config = ACHARYA_TABLE_CONFIG[acharya];
  const table = acharyaTable(acharya, "chatLogs");
  if (!table) return [];
  const { data } = await table
    .select("user_message, ai_response")
    .eq(config.learnerIdCol, learnerId)
    .order("created_at", { ascending: false })
    .limit(4);
  return (data || []).reverse().flatMap((row: { user_message: string; ai_response: string }) => ([
    { role: "user" as const, parts: [{ text: row.user_message }] },
    { role: "model" as const, parts: [{ text: row.ai_response }] },
  ]));
}

async function getCompletedModuleIds(acharya: AcharyaSlug, learnerId: string): Promise<string[]> {
  const config = ACHARYA_TABLE_CONFIG[acharya];
  const table = acharyaTable(acharya, "progress");
  if (!table) return [];
  const { data } = await table.select(config.moduleIdCol).eq(config.learnerIdCol, learnerId).eq("completed", true);
  return ((data || []) as unknown as Array<Record<string, unknown>>).map((r) => String(r[config.moduleIdCol]));
}

// ── Trilingual Fallback Quiz ────────────────────────────────────────────────

function fallbackQuizVajra(moduleId: string, lang: Lang): QuizQuestion[] {
  const suffix = moduleId ? ` (${moduleId})` : "";
  if (lang === "hi") return [
    { q: `काम शुरू करने से पहले सबसे पहले क्या करना चाहिए${suffix}?`, options: ["मेन सप्लाई बंद करें", "तार छुएं", "MCB बदल दें", "ग्राहक को बिल दें"], correct: 0, explanation: "किसी भी बोर्ड या वायरिंग को खोलने से पहले मेन सप्लाई बंद करके टेस्ट करना जरूरी है।" },
    { q: "RCCB मुख्य रूप से किससे बचाने में मदद करता है?", options: ["अर्थ लीकेज", "पेंट खराब होना", "कम रोशनी", "ड्रिल बिट टूटना"], correct: 0, explanation: "RCCB earth leakage detect करके supply trip कर सकता है।" },
    { q: "ओवरलोड से बचने का सही तरीका क्या है?", options: ["लोड और वायर साइज जांचें", "एक ही extension में सब लगाएं", "MCB बड़ा कर दें", "न्यूट्रल हटाएं"], correct: 0, explanation: "लोड, वायर साइज और MCB rating match होना चाहिए।" },
    { q: "Switchboard खोलने के बाद क्या चेक करना चाहिए?", options: ["Loose screw और burn mark", "दीवार का रंग", "ग्राहक का नाम", "मोबाइल नेटवर्क"], correct: 0, explanation: "Loose connection और heating marks faults के common signs हैं।" },
    { q: "Live conductor को छूना कब ठीक है?", options: ["कभी नहीं", "जब जल्दी हो", "अगर tester नहीं है", "दस्ताने गीले हों"], correct: 0, explanation: "Live conductor को touch नहीं करना चाहिए; isolate और test करें।" },
  ];
  if (lang === "bn") return [
    { q: `কাজ শুরু করার আগে প্রথমে কী করবেন${suffix}?`, options: ["মেইন সাপ্লাই বন্ধ", "তার ধরবেন", "MCB বদলাবেন", "বিল দেবেন"], correct: 0, explanation: "বোর্ড বা wiring খোলার আগে মেইন সাপ্লাই বন্ধ করে tester দিয়ে নিশ্চিত করতে হবে।" },
    { q: "RCCB মূলত কোন ঝুঁকিতে সাহায্য করে?", options: ["Earth leakage", "রঙ নষ্ট", "কম আলো", "ড্রিল ভাঙা"], correct: 0, explanation: "RCCB earth leakage হলে trip করতে পারে।" },
    { q: "Overload এড়ানোর সঠিক উপায় কী?", options: ["Load ও wire size দেখা", "সব এক extension-এ লাগানো", "বড় MCB লাগানো", "Neutral খুলে দেওয়া"], correct: 0, explanation: "Load, wire size ও MCB rating ঠিক মিলতে হবে।" },
    { q: "Switchboard খুলে কী দেখা জরুরি?", options: ["Loose screw ও burn mark", "দেয়ালের রঙ", "গ্রাহকের নাম", "মোবাইল network"], correct: 0, explanation: "Loose connection ও heating mark সাধারণ fault sign।" },
    { q: "Live conductor কখন ধরা ঠিক?", options: ["কখনো না", "তাড়া থাকলে", "tester না থাকলে", "ভেজা gloves থাকলে"], correct: 0, explanation: "Live conductor ধরা যাবে না; isolate ও test করতে হবে।" },
  ];
  return fallbackQuiz(moduleId || "this topic");
}

function escapeHtml(value: unknown): string { return String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }
function appLink(acharya: AcharyaSlug, path = "/"): string { return new URL(path, APP_URLS[acharya]).toString(); }
async function getBotState(learnerId: string): Promise<BotState> { return userBotStates.get(learnerId) || {}; }
async function setBotState(learnerId: string, next: BotState) { if (next.quiz || next.tool || next.apply) userBotStates.set(learnerId, next); else userBotStates.delete(learnerId); }
async function patchBotState(learnerId: string, patch: Partial<BotState>) { const cur = await getBotState(learnerId); await setBotState(learnerId, { ...cur, ...patch }); }
async function getLang(telegramUserId?: number): Promise<Lang> { if (!telegramUserId) return "en"; return userLangs.get(telegramUserId) || "en"; }
async function getAcharya(telegramUserId?: number): Promise<AcharyaSlug | null> { if (!telegramUserId) return null; return userAcharyas.get(telegramUserId) || null; }

// ── Menus ───────────────────────────────────────────────────────────────────

function acharyaPickerKeyboard() { return Markup.inlineKeyboard([[Markup.button.callback("Farmer Acharya", `${CP.acharya}farmer`)], [Markup.button.callback("Vajra Acharya", `${CP.acharya}vajra`)], [Markup.button.callback("Taksha Acharya", `${CP.acharya}taksha`)]]); }

function mainMenuKeyboard(acharya: AcharyaSlug) {
  const askLabel = `Ask ${ACHARYA_NAMES[acharya]}`;
  const rows: string[][] = [["Home", "Learn Modules"], ["Videos", "Quiz"], [askLabel, "Field Apply"]];
  if (acharya === "farmer") { rows.push(["Farm Tools", "My Progress"]); rows.push(["Language", "Open Website"]); }
  else { rows.push(["My Progress", "Language"]); rows.push(["Open Website"]); }
  rows.push(["Change Acharya"]);
  return Markup.keyboard(rows).resize();
}

function phoneKeyboard() { return Markup.keyboard([[Markup.button.contactRequest("Share my Telegram phone")], ["Type phone number"]]).oneTime().resize(); }

// ── Acharya Selection ───────────────────────────────────────────────────────

async function showAcharyaPicker(ctx: BotContext) { await ctx.reply("Welcome to Acharya!\n\nChoose your Acharya to get started:", acharyaPickerKeyboard()); }

async function setAcharya(ctx: BotContext, acharya: AcharyaSlug) {
  if (!ctx.from?.id) return;
  userAcharyas.set(ctx.from.id, acharya);
  const learner = await getTelegramLearner(acharya, ctx.from.id);
  if (learner) { userLangs.set(ctx.from.id, learner.preferred_lang || "en"); await ctx.reply(`Welcome back to ${ACHARYA_NAMES[acharya]}!`, Markup.removeKeyboard()); await sendHome(ctx, acharya, learner); return; }
  await ctx.reply(`You selected ${ACHARYA_NAMES[acharya]}.\n\nPlease login with your phone number first.`, phoneKeyboard());
}

// ── Login ───────────────────────────────────────────────────────────────────

async function loginWithPhone(ctx: BotContext, acharya: AcharyaSlug, rawPhone: string) {
  if (!ctx.from?.id || !ctx.chat?.id) return;
  const phone = normalizeIndianPhone(rawPhone);
  if (!phone) { await ctx.reply("Please send a valid 10-digit Indian mobile number, for example 9876543210."); return; }
  const name = telegramName(ctx.from); const lang = await getLang(ctx.from.id);
  const learner = await upsertTelegramUser(acharya, ctx.from.id, ctx.chat.id, phone, name, ctx.from.username || null, lang);
  if (!learner) { await ctx.reply("Login failed while saving your profile. Please try again."); return; }
  userLangs.set(ctx.from.id, learner.preferred_lang || "en");
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
  const date = new Date().toLocaleDateString(lang === "bn" ? "bn-IN" : lang === "hi" ? "hi-IN" : "en-IN", { weekday: "long", day: "numeric", month: "short" });
  const lines = [`<b>${ACHARYA_NAMES[acharya]}</b>`, `${escapeHtml(date)}`, "", `Modules completed: <b>${summary.completedModules}/${modules.length || 0}</b>`, `Quizzes: <b>${summary.quizCount}</b> | Avg score: <b>${summary.avgScore}%</b>`, current ? `Continue: <b>${escapeHtml(titleOf(current, lang))}</b>` : "", "", "Choose a tool below, or type any question."].filter(Boolean);
  await ctx.reply(lines.join("\n"), { parse_mode: "HTML", ...mainMenuKeyboard(acharya) });
  const quick: InlineButton[] = [];
  if (current) quick.push(Markup.button.callback("Continue Learning", `${CP.module}${current.id}`));
  quick.push(Markup.button.url("Open Website", appLink(acharya, "/")));
  await ctx.reply("Quick links:", Markup.inlineKeyboard([quick]));
}

// ── Module List ─────────────────────────────────────────────────────────────

async function sendModuleList(ctx: BotContext, acharya: AcharyaSlug, learner: TelegramLearner, page = 0, mode: "learn" | "videos" | "quiz" | "apply" = "learn") {
  const lang = await getLang(ctx.from?.id);
  const modules = await loadModules(acharya);
  if (modules.length === 0) { await ctx.reply("No modules are available yet."); return; }
  const total = Math.max(1, Math.ceil(modules.length / MODULE_PAGE_SIZE));
  const safePage = Math.min(Math.max(page, 0), total - 1);
  const rows = modules.slice(safePage * MODULE_PAGE_SIZE, (safePage + 1) * MODULE_PAGE_SIZE);
  const prefix = mode === "videos" ? CP.videos : mode === "quiz" ? CP.quizModule : mode === "apply" ? CP.applyModule : CP.module;
  const buttons: InlineButton[][] = rows.map((m, i) => [Markup.button.callback(`${safePage * MODULE_PAGE_SIZE + i + 1}. ${titleOf(m, lang).slice(0, 46)}`, `${prefix}${m.id}`)]);
  const nav: InlineButton[] = [];
  if (safePage > 0) nav.push(Markup.button.callback("Prev", `${CP.modules}${mode}:${safePage - 1}`));
  if (safePage < total - 1) nav.push(Markup.button.callback("Next", `${CP.modules}${mode}:${safePage + 1}`));
  if (nav.length) buttons.push(nav);
  const title = mode === "videos" ? "Choose a module for videos" : mode === "quiz" ? "Choose a module for quiz" : mode === "apply" ? "Choose a module for field apply" : "Choose a learning module";
  await ctx.reply(`<b>${title}</b>\nPage ${safePage + 1}/${total}`, { parse_mode: "HTML", ...Markup.inlineKeyboard(buttons) });
}

// ── Module Details (Sections) ───────────────────────────────────────────────
async function sendModuleDetails(ctx: BotContext, acharya: AcharyaSlug, learner: TelegramLearner, moduleId: string) {
  const lang = await getLang(ctx.from?.id);
  const mod = await getModuleById(acharya, moduleId);
  if (!mod) { await ctx.reply("Module not found."); return; }
  const sections = await loadSections(acharya, moduleId);
  if (!sections.length) { await ctx.reply("No sections available yet.", Markup.inlineKeyboard([[Markup.button.url("Open Learn Page", appLink(acharya, "/learn"))]])); return; }
  const progress = await getProgress(acharya, learner.id, moduleId);
  const completed = progress.sections_completed;
  const text = [`<b>${escapeHtml(titleOf(mod, lang))}</b>`, `Progress: ${completed.length}/${sections.length} sections`, "", "Choose a section:"].join("\n");
  const buttons: InlineButton[][] = sections.map((s, i) => [Markup.button.callback(`${completed.includes(s.id) ? "Done " : ""}${i + 1}. ${titleOf(s, lang).slice(0, 45)}`, `${CP.section}${s.id}`)]);
  buttons.push([Markup.button.callback("Videos", `${CP.videos}${moduleId}`), Markup.button.callback("Quiz", `${CP.quizModule}${moduleId}`)]);
  buttons.push([Markup.button.url("Open Learn Page", appLink(acharya, "/learn"))]);
  await ctx.reply(text, { parse_mode: "HTML", ...Markup.inlineKeyboard(buttons) });
}

// ── Section Content ─────────────────────────────────────────────────────────

async function sendSection(ctx: BotContext, acharya: AcharyaSlug, learner: TelegramLearner, sectionId: string) {
  const lang = await getLang(ctx.from?.id);
  const modules = await loadModules(acharya);
  let section: SectionRow | null = null;
  for (const mod of modules) { const secs = await loadSections(acharya, mod.id); const found = secs.find((s) => s.id === sectionId); if (found) { section = found; break; } }
  if (!section) { await ctx.reply("Section not found."); return; }
  const text = `<b>${escapeHtml(titleOf(section, lang))}</b>\n\n${escapeHtml(bodyOf(section, lang)).slice(0, 3600)}`;
  await ctx.reply(text, { parse_mode: "HTML", ...Markup.inlineKeyboard([[Markup.button.callback("Mark Complete", `${CP.complete}${section.id}`)], [Markup.button.callback("Back to Module", `${CP.module}${section.module_id}`), Markup.button.url("Open App", appLink(acharya, "/learn"))]]) });
}

// ── Complete Section ────────────────────────────────────────────────────────

async function completeSection(ctx: BotContext, acharya: AcharyaSlug, learner: TelegramLearner, sectionId: string) {
  const modules = await loadModules(acharya);
  let sectionModuleId = "";
  for (const mod of modules) { const secs = await loadSections(acharya, mod.id); if (secs.some((s) => s.id === sectionId)) { sectionModuleId = mod.id; break; } }
  if (!sectionModuleId) { await ctx.reply("Section not found."); return; }
  const existing = await getProgress(acharya, learner.id, sectionModuleId);
  const sectionsCompleted = Array.from(new Set([...existing.sections_completed, sectionId]));
  const allSections = await loadSections(acharya, sectionModuleId);
  const completed = allSections.length > 0 && sectionsCompleted.length >= allSections.length;
  await upsertProgress(acharya, learner.id, sectionModuleId, sectionsCompleted, completed);
  await ctx.reply(completed ? "Module complete. Nicely done." : "Section marked complete.", Markup.inlineKeyboard([[Markup.button.callback("Back to Module", `${CP.module}${sectionModuleId}`), Markup.button.callback("Try Quiz", `${CP.quizModule}${sectionModuleId}`)]]));
}

// ── Videos ──────────────────────────────────────────────────────────────────

async function sendVideos(ctx: BotContext, acharya: AcharyaSlug, learner: TelegramLearner, moduleId: string) {
  const lang = await getLang(ctx.from?.id);
  const mod = await getModuleById(acharya, moduleId);
  const videos = await loadVideos(acharya, moduleId);
  if (!videos.length) { await ctx.reply("No videos available yet.", Markup.inlineKeyboard([[Markup.button.url("Open Video Page", appLink(acharya, "/video"))]])); return; }
  const lines = [`<b>Videos${mod ? `: ${escapeHtml(titleOf(mod, lang))}` : ""}</b>`];
  for (const v of videos) { const url = `https://www.youtube.com/watch?v=${v.youtube_id}${v.start_seconds ? `&t=${v.start_seconds}s` : ""}`; lines.push(`\n<b>${escapeHtml(titleOf(v, lang))}</b>${v.duration ? ` (${escapeHtml(v.duration)})` : ""}\n${url}`); }
  await ctx.reply(lines.join("\n"), { parse_mode: "HTML", ...Markup.inlineKeyboard([[Markup.button.url("Open Video Page", appLink(acharya, "/video"))]]) });
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

async function generateQuiz(acharya: AcharyaSlug, moduleId: string, lang: Lang, learnerId: string): Promise<QuizQuestion[]> {
  const moduleRow = await getModuleById(acharya, moduleId);
  const topic = moduleRow ? titleOf(moduleRow, lang) : "this module";
  if (!model) {
    if (acharya === "vajra") return fallbackQuizVajra(moduleId, lang);
    return fallbackQuiz(topic);
  }
  const completedIds = await getCompletedModuleIds(acharya, learnerId);
  const langI = lang === "bn" ? "Write Bengali in Bengali script." : lang === "hi" ? "Write Hindi in Devanagari script." : "Write simple English.";
  const prompt = `${getSystemPrompt(acharya)}\n\nCreate a 5-question multiple-choice quiz.\nTopic: ${topic}\nCompleted modules for context: ${completedIds.join(", ") || "none"}.\nRules:\n- ${langI}\n- Practical field knowledge only.\n- Return ONLY JSON:\n{"questions":[{"q":"...","options":["...","...","...","..."],"correct":0,"explanation":"..."}]}`;
  try {
    const result = await model.generateContent({ contents: [{ role: "user", parts: [{ text: prompt }] }], generationConfig: { temperature: 0.35, maxOutputTokens: 1400, responseMimeType: "application/json" } });
    const raw = result.response.text().trim().replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim();
    const parsed = JSON.parse(raw) as { questions?: QuizQuestion[] };
    const questions = Array.isArray(parsed.questions) ? parsed.questions.filter((q) => q.q && Array.isArray(q.options) && q.options.length >= 2 && Number.isInteger(q.correct)).slice(0, 5) : [];
    return questions.length ? questions : (acharya === "vajra" ? fallbackQuizVajra(moduleId, lang) : fallbackQuiz(topic));
  } catch { return acharya === "vajra" ? fallbackQuizVajra(moduleId, lang) : fallbackQuiz(topic); }
}

async function startQuiz(ctx: BotContext, acharya: AcharyaSlug, learner: TelegramLearner, moduleId: string) {
  await ctx.reply("Preparing quiz...");
  const lang = await getLang(ctx.from?.id);
  const questions = await generateQuiz(acharya, moduleId, lang, learner.id);
  const quiz: QuizState = { moduleId, lang, questions, idx: 0, score: 0 };
  await patchBotState(learner.id, { quiz });
  await sendQuizQuestion(ctx, quiz);
}

async function sendQuizQuestion(ctx: BotContext, state: QuizState) {
  const q = state.questions[state.idx];
  const buttons = q.options.slice(0, 4).map((opt, i) => [Markup.button.callback(`${String.fromCharCode(65 + i)}. ${opt.slice(0, 48)}`, `${CP.quizAnswer}${i}`)]);
  await ctx.reply(`<b>Question ${state.idx + 1}/${state.questions.length}</b>\n\n${escapeHtml(q.q)}`, { parse_mode: "HTML", ...Markup.inlineKeyboard(buttons) });
}

async function answerQuiz(ctx: BotContext, acharya: AcharyaSlug, learner: TelegramLearner, optIdx: number) {
  const state = (await getBotState(learner.id)).quiz;
  if (!state) { await ctx.reply("Start a quiz from the Quiz menu."); return; }
  const q = state.questions[state.idx];
  const correct = optIdx === q.correct;
  if (correct) state.score += 1;
  state.idx += 1;
  await ctx.reply(`${correct ? "<b>Correct!</b>" : "<b>Incorrect.</b>"}\n\n${escapeHtml(q.explanation)}`, { parse_mode: "HTML" });
  if (state.idx < state.questions.length) { await patchBotState(learner.id, { quiz: state }); await sendQuizQuestion(ctx, state); return; }
  await patchBotState(learner.id, { quiz: undefined });
  await logQuizAttempt(acharya, learner.id, state.moduleId, state.score, state.questions.length, state.questions);
  await ctx.reply(`Quiz complete.\nScore: ${state.score}/${state.questions.length}`, Markup.inlineKeyboard([[Markup.button.callback("Retake", `${CP.quizModule}${state.moduleId}`), Markup.button.url("Open Progress", appLink(acharya, "/progress"))]]));
}

// ── Ask (AI Chat) ───────────────────────────────────────────────────────────

async function answerTextQuestion(ctx: BotContext, acharya: AcharyaSlug, learner: TelegramLearner, text: string) {
  if (!model) { await ctx.reply("My AI brain is offline."); return; }
  const started = Date.now(); const lang = await getLang(ctx.from?.id);
  await ctx.sendChatAction("typing");
  // Build conversation context from history
  const history = await getChatHistory(acharya, learner.id);
  const historyText = history.length
    ? "\n\nConversation history:\n" + history.map((h) => `${h.role === "user" ? "User" : "Assistant"}: ${h.parts[0]?.text || ""}`).join("\n")
    : "";
  const prompt = `${getSystemPrompt(acharya)}\n\nPreferred language code: ${lang}. Match the user's language when possible.${historyText}\n\nUser says: ${text}`;
  const result = await model.generateContent(prompt);
  const answer = result.response.text();
  await logChat(acharya, learner.id, lang, text, answer, Date.now() - started);
  await ctx.reply(answer);
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
    const prompt = `${getSystemPrompt(acharya)}\n\nAnalyze this image directly. Return practical findings and action steps. Preferred language code: ${lang}.${caption}`;
    const result = await model.generateContent([{ inlineData: { data: buffer.toString("base64"), mimeType } }, { text: prompt }]);
    const answer = result.response.text().trim();
    await logChat(acharya, learner.id, lang, `[image: ${mimeType}]`, answer, Date.now() - started);
    await ctx.reply(answer || "I analyzed the image but got no useful response. Please try a clearer photo.");
  } catch { await ctx.reply("I could not analyze that image. Please send a clear, well-lit photo."); }
}

// ── Apply (Field Reports) ───────────────────────────────────────────────────

async function startApply(ctx: BotContext, acharya: AcharyaSlug, learner: TelegramLearner, moduleId: string) {
  const mod = await getModuleById(acharya, moduleId);
  const lang = await getLang(ctx.from?.id);
  await patchBotState(learner.id, { apply: { turns: [], moduleId } });
  await ctx.reply(`Field Apply started${mod ? ` for ${titleOf(mod, lang)}` : ""}.\n\nSend text, voice, or a photo. When finished, type: Submit Progress`);
}

async function handleApplyText(ctx: BotContext, acharya: AcharyaSlug, learner: TelegramLearner, text: string): Promise<boolean> {
  const state = (await getBotState(learner.id)).apply;
  if (!state) return false;
  if (/^(submit progress|submit|finish)$/i.test(text.trim())) { await submitApply(ctx, acharya, learner, state); await patchBotState(learner.id, { apply: undefined }); return true; }
  state.turns.push({ text: text.slice(0, 1000) });
  await patchBotState(learner.id, { apply: state });
  await ctx.reply("Added to your report. Send more details/photo/voice, or type: Submit Progress");
  return true;
}

async function addApplyPhoto(ctx: BotContext, learner: TelegramLearner): Promise<boolean> {
  const state = (await getBotState(learner.id)).apply;
  if (!state) return false;
  const caption = ctx.message?.caption || "Photo attached";
  state.turns.push({ text: caption.slice(0, 1000), hasPhoto: true });
  await patchBotState(learner.id, { apply: state });
  await ctx.reply("Photo added to your report. Send more details, or type: Submit Progress");
  return true;
}

async function submitApply(ctx: BotContext, acharya: AcharyaSlug, learner: TelegramLearner, state: ApplyState) {
  const lang = await getLang(ctx.from?.id);
  const input = state.turns.map((t, i) => `${i + 1}. ${t.text}${t.hasPhoto ? " (photo)" : ""}`).join("\n").slice(0, 5000);
  if (!input) { await ctx.reply("Send at least one field update before submitting."); return; }
  let parsed = { summary: input.slice(0, 120), score: 6, feedback: "Good start. Add more details next time.", nextStep: "Observe and record one concrete action." };
  if (model) {
    try {
      const prompt = `${getSystemPrompt(acharya)}\n\nEvaluate this field report. Return ONLY JSON:\n{"summary":"one-line summary","score":7,"feedback":"2 short specific sentences","nextStep":"one practical next step"}\nScore 1-10. Reply language code: ${lang}.\nReport:\n${input}`;
      const result = await model.generateContent({ contents: [{ role: "user", parts: [{ text: prompt }] }], generationConfig: { responseMimeType: "application/json", maxOutputTokens: 700 } });
      parsed = { ...parsed, ...JSON.parse(result.response.text()) };
    } catch { /* fallback */ }
  }
  const score = Math.max(0, Math.min(10, Number(parsed.score) || 6));
  await logApply(acharya, learner.id, state.moduleId, { log_type: "self_assessment", data: { input, score, feedback: parsed.feedback, nextStep: parsed.nextStep } });
  await ctx.reply(`<b>Score: ${score}/10</b>\n\n${escapeHtml(parsed.summary)}\n\n<b>Feedback</b>\n${escapeHtml(parsed.feedback)}\n\n<b>Next step</b>\n${escapeHtml(parsed.nextStep)}`, { parse_mode: "HTML", ...Markup.inlineKeyboard([[Markup.button.url("Open Apply Page", appLink(acharya, "/apply"))]]) });
}

// ── Tools (Farmer only) ─────────────────────────────────────────────────────

async function sendTools(ctx: BotContext, acharya: AcharyaSlug) {
  if (acharya !== "farmer") { await ctx.reply("Tools are specific to each Acharya. Use Ask to get guidance."); return; }
  await ctx.reply("<b>Farm Tools</b>\nChoose a tool:", { parse_mode: "HTML", ...Markup.inlineKeyboard([[Markup.button.callback("Weather", `${CP.tool}weather`), Markup.button.callback("Mandi Prices", `${CP.tool}mandi`)], [Markup.button.callback("Crop Calendar", `${CP.tool}calendar`), Markup.button.callback("Fertilizer Calculator", `${CP.tool}fertilizer`)], [Markup.button.callback("Farm Diary", `${CP.tool}diary`), Markup.button.url("Open Tools Page", appLink(acharya, "/tools"))]]) });
}

async function handleToolAction(ctx: BotContext, acharya: AcharyaSlug, learner: TelegramLearner, tool: string) {
  await patchBotState(learner.id, { tool: undefined });
  if (tool === "weather") { await patchBotState(learner.id, { tool: { kind: "weather" } }); await ctx.reply("Send location as: Weather Kolkata\nFor default Kolkata forecast, type: Weather"); }
  else if (tool === "mandi") { await patchBotState(learner.id, { tool: { kind: "mandi" } }); await ctx.reply("Send crop and optional state as: Mandi Wheat Punjab\nOr: Mandi Paddy"); }
  else if (tool === "calendar") { await ctx.reply("<b>Crop Calendar</b>\n1. Seed/Nursery - prepare seed and records.\n2. Sowing - sow at recommended spacing.\n3. Irrigation + nutrients - track water, weeds and pests.\n4. Harvest + selling - grade, store, compare markets.", { parse_mode: "HTML" }); }
  else if (tool === "fertilizer") { await patchBotState(learner.id, { tool: { kind: "fertilizer" } }); await ctx.reply("Send: Fertilizer area N P K\nExample: Fertilizer 2 40 20 20"); }
  else if (tool === "diary") { await patchBotState(learner.id, { tool: { kind: "diary", step: "crop" } }); await ctx.reply("Farm diary: what crop?"); }
}

async function handleToolText(ctx: BotContext, acharya: AcharyaSlug, learner: TelegramLearner, text: string): Promise<boolean> {
  const lower = text.toLowerCase();
  const state = (await getBotState(learner.id)).tool;
  if (!state && !lower.startsWith("weather") && !lower.startsWith("mandi") && !lower.startsWith("price") && !lower.startsWith("fertilizer")) return false;
  if (state?.kind === "diary") { await handleDiaryStep(ctx, acharya, learner, state, text); return true; }
  if (state?.kind === "fertilizer" || lower.startsWith("fertilizer")) {
    const nums = text.replace(/^fertilizer/i, "").trim().split(/\s+/).map(Number).filter(Number.isFinite);
    if (nums.length < 4) { await ctx.reply("Send: Fertilizer area N P K\nExample: Fertilizer 2 40 20 20"); return true; }
    const [area, n, p, k] = nums;
    await patchBotState(learner.id, { tool: undefined });
    await ctx.reply(`Fertilizer estimate for ${area} acres:\nUrea: ${Math.round((n * area) / 0.46)} kg\nDAP: ${Math.round((p * area) / 0.46)} kg\nMOP: ${Math.round((k * area) / 0.60)} kg\n\nUse only for planning. Final dose should follow soil test and local KVK advice.`);
    return true;
  }
  if (state?.kind === "weather" || lower.startsWith("weather")) { await patchBotState(learner.id, { tool: undefined }); await sendWeather(ctx, text.replace(/^weather/i, "").trim()); return true; }
  if (state?.kind === "mandi" || lower.startsWith("mandi") || lower.startsWith("price")) { await patchBotState(learner.id, { tool: undefined }); await sendMandi(ctx, text.replace(/^(mandi|price)/i, "").trim()); return true; }
  return false;
}

async function sendWeather(ctx: BotContext, query: string) {
  const coords = cityCoords(query);
  const qs = new URLSearchParams({ latitude: String(coords.lat), longitude: String(coords.lon), daily: "temperature_2m_max,temperature_2m_min,precipitation_sum,wind_speed_10m_max", timezone: "auto", forecast_days: "5" });
  try {
    const res = await fetch(`https://api.open-meteo.com/v1/forecast?${qs}`);
    const data = await res.json();
    const daily = data.daily || {};
    const lines = [`<b>Weather: ${escapeHtml(coords.label)}</b>`];
    for (let i = 0; i < Math.min(5, daily.time?.length || 0); i++) lines.push(`${daily.time[i]}: ${daily.temperature_2m_min?.[i] ?? "-"}-${daily.temperature_2m_max?.[i] ?? "-"} C, rain ${daily.precipitation_sum?.[i] ?? 0} mm`);
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
  const commodity = commodityRaw || "Paddy"; const state = stateParts.join(" ");
  const apiKey = (process.env.DATA_GOV_API_KEY || "").trim();
  if (!apiKey) { await ctx.reply(`Live mandi prices need DATA_GOV_API_KEY.\n\nQuery: ${commodity}${state ? `, ${state}` : ""}`); return; }
  const qs = new URLSearchParams({ "api-key": apiKey, format: "json", limit: "5", "filters[commodity]": commodity });
  if (state) qs.set("filters[state]", state);
  try {
    const res = await fetch(`https://api.data.gov.in/resource/9ef84268-d588-465a-a308-a864a43d0070?${qs}`);
    const data = await res.json();
    const records = Array.isArray(data.records) ? data.records : [];
    if (!records.length) { await ctx.reply("No mandi records found. Try another crop or state."); return; }
    const lines = [`<b>Mandi prices: ${escapeHtml(commodity)}</b>`];
    for (const r of records.slice(0, 5) as Array<Record<string, string>>) lines.push(`${r.state || ""} ${r.market || "-"}: Rs ${r.modal_price || "-"} (${r.arrival_date || ""})`);
    await ctx.reply(lines.join("\n"), { parse_mode: "HTML" });
  } catch { await ctx.reply("Could not load mandi prices. Try again later."); }
}

async function handleDiaryStep(ctx: BotContext, acharya: AcharyaSlug, learner: TelegramLearner, state: Extract<ToolState, { kind: "diary" }>, text: string) {
  if (state.step === "crop") { await patchBotState(learner.id, { tool: { ...state, crop: text.slice(0, 120), step: "activity" } }); await ctx.reply("What activity did you do?"); }
  else if (state.step === "activity") { await patchBotState(learner.id, { tool: { ...state, activity: text.slice(0, 160), step: "expense" } }); await ctx.reply("Expense amount? Send 0 if none."); }
  else if (state.step === "expense") { await patchBotState(learner.id, { tool: { ...state, expense: Number(text.replace(/[^\d.]/g, "")) || 0, step: "notes" } }); await ctx.reply("Any notes? Send '-' if none."); }
  else { await logDiary(acharya, learner.id, { crop: state.crop || "", activity: state.activity || "Field activity", expense: state.expense || 0, notes: text === "-" ? "" : text.slice(0, 1000) }); await patchBotState(learner.id, { tool: undefined }); await ctx.reply("Diary entry saved."); }
}

// ── Progress ────────────────────────────────────────────────────────────────

async function sendProgress(ctx: BotContext, acharya: AcharyaSlug, learner: TelegramLearner) {
  const modules = await loadModules(acharya);
  const summary = await progressSummary(acharya, learner.id);
  await ctx.reply(`<b>My Progress</b>\nModules completed: <b>${summary.completedModules}/${modules.length}</b>\nQuizzes: <b>${summary.quizCount}</b>\nAverage score: <b>${summary.avgScore}%</b>`, { parse_mode: "HTML", ...Markup.inlineKeyboard([[Markup.button.url("Open Progress Page", appLink(acharya, "/progress"))]]) });
}

// ── Voice Transcription ────────────────────────────────────────────────────

async function transcribeVoice(ctx: BotContext): Promise<string | null> {
  if (!model || !ctx.message?.voice) return null;
  const fileLink = await ctx.telegram.getFileLink(ctx.message.voice.file_id);
  const response = await fetch(fileLink.href);
  if (!response.ok) return null;
  const buffer = Buffer.from(await response.arrayBuffer());
  const result = await model.generateContent([{ text: "Transcribe this voice message. Return only the spoken text in the same language." }, { inlineData: { data: buffer.toString("base64"), mimeType: "audio/ogg" } }]);
  return result.response.text().trim();
}

// ── Helper: require logged-in learner ───────────────────────────────────────

async function requireLearner(ctx: BotContext): Promise<{ acharya: AcharyaSlug; learner: TelegramLearner } | null> {
  const fromId = ctx.from?.id;
  if (!fromId) return null;
  const acharya = await getAcharya(fromId);
  if (!acharya) { await showAcharyaPicker(ctx); return null; }
  const learner = await getTelegramLearner(acharya, fromId);
  if (!learner) { await ctx.reply("Please login with your phone number first.", phoneKeyboard()); return null; }
  return { acharya, learner };
}

// ══════════════════════════════════════════════════════════════════════════════
// TELEGRAF BOT SETUP
// ══════════════════════════════════════════════════════════════════════════════

if (bot) {
  bot.start(async (ctx) => {
    const fromId = ctx.from?.id;
    if (!fromId) return;
    const existingAcharya = await getAcharya(fromId);
    if (existingAcharya) {
      const learner = await getTelegramLearner(existingAcharya, fromId);
      if (learner) { await sendHome(ctx, existingAcharya, learner); return; }
      await ctx.reply(`You selected ${ACHARYA_NAMES[existingAcharya]}.\n\nPlease login with your phone number first.`, phoneKeyboard());
      return;
    }
    await showAcharyaPicker(ctx);
  });

  bot.command("login", async (ctx) => {
    const fromId = ctx.from?.id; if (!fromId) return;
    const acharya = await getAcharya(fromId);
    if (!acharya) { await showAcharyaPicker(ctx); return; }
    await ctx.reply("Send your mobile number to login.", phoneKeyboard());
  });

  bot.hears("Type phone number", async (ctx) => ctx.reply("Type your 10-digit Indian mobile number."));
  bot.hears("Change Acharya", async (ctx) => { if (ctx.from?.id) { userAcharyas.delete(ctx.from.id); userBotStates.clear(); } await showAcharyaPicker(ctx); });

  bot.action(/^ach:(farmer|vajra|taksha)$/, async (ctx) => { await ctx.answerCbQuery(); await setAcharya(ctx, ctx.match[1] as AcharyaSlug); });

  bot.on("contact", async (ctx) => {
    const fromId = ctx.from?.id; if (!fromId) return;
    const acharya = await getAcharya(fromId);
    if (!acharya) { await showAcharyaPicker(ctx); return; }
    const contact = ctx.message?.contact;
    if (!contact) return;
    if (contact.user_id && contact.user_id !== fromId) { await ctx.reply("Please share your own Telegram phone number."); return; }
    await loginWithPhone(ctx, acharya, contact.phone_number);
  });

  bot.hears("Home", async (ctx) => { const r = await requireLearner(ctx); if (r) await sendHome(ctx, r.acharya, r.learner); });
  bot.hears("Learn Modules", async (ctx) => { const r = await requireLearner(ctx); if (r) await sendModuleList(ctx, r.acharya, r.learner, 0, "learn"); });
  bot.hears("Videos", async (ctx) => { const r = await requireLearner(ctx); if (r) await sendModuleList(ctx, r.acharya, r.learner, 0, "videos"); });
  bot.hears("Quiz", async (ctx) => { const r = await requireLearner(ctx); if (r) await sendModuleList(ctx, r.acharya, r.learner, 0, "quiz"); });
  bot.hears("Field Apply", async (ctx) => { const r = await requireLearner(ctx); if (r) await sendModuleList(ctx, r.acharya, r.learner, 0, "apply"); });
  bot.hears("My Progress", async (ctx) => { const r = await requireLearner(ctx); if (r) await sendProgress(ctx, r.acharya, r.learner); });
  bot.hears("Ask Farmer Acharya", async (ctx) => { const r = await requireLearner(ctx); if (r) await ctx.reply("Ask me by typing a question, recording a voice message, or sending a photo."); });
  bot.hears("Ask Vajra Acharya", async (ctx) => { const r = await requireLearner(ctx); if (r) await ctx.reply("Ask me by typing a question, recording a voice message, or sending a photo."); });
  bot.hears("Ask Taksha Acharya", async (ctx) => { const r = await requireLearner(ctx); if (r) await ctx.reply("Ask me by typing a question, recording a voice message, or sending a photo."); });
  bot.hears("Farm Tools", async (ctx) => { const r = await requireLearner(ctx); if (r) await sendTools(ctx, r.acharya); });
  bot.hears("Open Website", async (ctx) => { const r = await requireLearner(ctx); if (r) await ctx.reply(`Open ${ACHARYA_NAMES[r.acharya]} website:`, Markup.inlineKeyboard([[Markup.button.url("Open Website", appLink(r.acharya, "/"))]])); });
  bot.hears("Language", async (ctx) => { const r = await requireLearner(ctx); if (r) await ctx.reply("Choose your preferred language:", Markup.inlineKeyboard([[Markup.button.callback("English", "lang_en")], [Markup.button.callback("Hindi", "lang_hi")], [Markup.button.callback("Bengali", "lang_bn")]])); });

  bot.action(/^lang_(en|hi|bn)$/, async (ctx) => {
    const r = await requireLearner(ctx); if (!r) return;
    const lang = ctx.match[1] as Lang;
    if (ctx.from?.id) userLangs.set(ctx.from.id, lang);
    await ctx.answerCbQuery(`Language set to ${lang}.`);
    await ctx.editMessageText(`Language set to ${lang}.`);
  });

  bot.action(/^mods:(learn|videos|quiz|apply):(\d+)$/, async (ctx) => { await ctx.answerCbQuery(); const r = await requireLearner(ctx); if (r) await sendModuleList(ctx, r.acharya, r.learner, Number(ctx.match[2]), ctx.match[1] as "learn" | "videos" | "quiz" | "apply"); });
  bot.action(/^mod:(.+)$/, async (ctx) => { await ctx.answerCbQuery(); const r = await requireLearner(ctx); if (r) await sendModuleDetails(ctx, r.acharya, r.learner, ctx.match[1]); });
  bot.action(/^sec:(.+)$/, async (ctx) => { await ctx.answerCbQuery(); const r = await requireLearner(ctx); if (r) await sendSection(ctx, r.acharya, r.learner, ctx.match[1]); });
  bot.action(/^done:(.+)$/, async (ctx) => { await ctx.answerCbQuery(); const r = await requireLearner(ctx); if (r) await completeSection(ctx, r.acharya, r.learner, ctx.match[1]); });
  bot.action(/^vids:(.+)$/, async (ctx) => { await ctx.answerCbQuery(); const r = await requireLearner(ctx); if (r) await sendVideos(ctx, r.acharya, r.learner, ctx.match[1]); });
  bot.action(/^qmod:(.+)$/, async (ctx) => { await ctx.answerCbQuery(); const r = await requireLearner(ctx); if (r) await startQuiz(ctx, r.acharya, r.learner, ctx.match[1]); });
  bot.action(/^qa:(\d+)$/, async (ctx) => { await ctx.answerCbQuery(); const r = await requireLearner(ctx); if (r) await answerQuiz(ctx, r.acharya, r.learner, Number(ctx.match[1])); });
  bot.action(/^apmod:(.+)$/, async (ctx) => { await ctx.answerCbQuery(); const r = await requireLearner(ctx); if (r) await startApply(ctx, r.acharya, r.learner, ctx.match[1]); });
  bot.action(/^tool:(weather|mandi|calendar|fertilizer|diary)$/, async (ctx) => { await ctx.answerCbQuery(); const r = await requireLearner(ctx); if (r) await handleToolAction(ctx, r.acharya, r.learner, ctx.match[1]); });

  bot.on("voice", async (ctx) => {
    const r = await requireLearner(ctx); if (!r) return;
    try {
      await ctx.sendChatAction("typing"); const started = Date.now();
      const transcript = await transcribeVoice(ctx);
      if (!transcript) { await ctx.reply("I could not understand that. Please try again."); return; }
      const applyState = (await getBotState(r.learner.id)).apply;
      if (applyState) { applyState.turns.push({ text: transcript }); await patchBotState(r.learner.id, { apply: applyState }); await ctx.reply(`Added voice note: "${transcript}"\n\nSend more details/photo, or type: Submit Progress`); return; }
      const lang = await getLang(ctx.from?.id);
      const history = await getChatHistory(r.acharya, r.learner.id);
      const historyText = history.length
        ? "\n\nConversation history:\n" + history.map((h) => `${h.role === "user" ? "User" : "Assistant"}: ${h.parts[0]?.text || ""}`).join("\n")
        : "";
      const prompt = `${getSystemPrompt(r.acharya)}\n\nAnswer this transcribed voice message in under 150 words. Preferred language: ${lang}.${historyText}\n\nMessage: ${transcript}`;
      const answer = (await model!.generateContent(prompt)).response.text();
      await logChat(r.acharya, r.learner.id, lang, `[voice] ${transcript}`, answer, Date.now() - started);
      await ctx.reply(answer);
    } catch { await ctx.reply("I could not process that voice message."); }
  });

  bot.on("photo", async (ctx) => {
    const r = await requireLearner(ctx); if (!r) return;
    if (await addApplyPhoto(ctx, r.learner)) return;
    const photo = ctx.message?.photo?.[(ctx.message.photo.length || 1) - 1];
    if (!photo) { await ctx.reply("Please send a clear photo."); return; }
    await analyzeImage(ctx, r.acharya, r.learner, photo.file_id);
  });

  bot.on("document", async (ctx) => {
    const r = await requireLearner(ctx); if (!r) return;
    if (await addApplyPhoto(ctx, r.learner)) return;
    const doc = ctx.message?.document;
    const mimeType = doc?.mime_type || mimeFromFileName(doc?.file_name);
    if (!doc || !mimeType?.startsWith("image/")) { await ctx.reply("Please send an image file, or use Telegram's photo option."); return; }
    await analyzeImage(ctx, r.acharya, r.learner, doc.file_id, mimeType);
  });

  bot.on("text", async (ctx) => {
    const text = ctx.message?.text?.trim();
    if (!text) return;
    const menuTexts = ["Home", "Learn Modules", "Videos", "Quiz", "Field Apply", "My Progress", "Farm Tools", "Open Website", "Language", "Change Acharya", "Ask Farmer Acharya", "Ask Vajra Acharya", "Ask Taksha Acharya", "Type phone number"];
    if (menuTexts.includes(text)) return;

    const fromId = ctx.from?.id; if (!fromId) return;
    const acharya = await getAcharya(fromId);
    if (!acharya) { await showAcharyaPicker(ctx); return; }

    const learner = await getTelegramLearner(acharya, fromId);
    if (!learner) {
      const typedPhone = normalizeIndianPhone(text);
      if (typedPhone) { await loginWithPhone(ctx, acharya, typedPhone); return; }
      await ctx.reply("Please login with your phone number first.", phoneKeyboard());
      return;
    }

    if (await handleApplyText(ctx, acharya, learner, text)) return;
    if (acharya === "farmer" && await handleToolText(ctx, acharya, learner, text)) return;

    try { await answerTextQuestion(ctx, acharya, learner, text); }
    catch { await ctx.reply("I could not answer that right now. Please try again."); }
  });
}

// ══════════════════════════════════════════════════════════════════════════════
// ROUTE HANDLERS
// ══════════════════════════════════════════════════════════════════════════════

export async function POST(request: Request) {
  const configuredSecret = process.env.TELEGRAM_WEBHOOK_SECRET || "";
  if (configuredSecret) {
    const secret = request.headers.get("x-telegram-bot-api-secret-token");
    if (secret !== configuredSecret) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
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
  return NextResponse.json({ status: botToken ? "Configured" : "Missing TELEGRAM_BOT_TOKEN", database: dbConfigured ? "Configured" : "Missing Supabase", acharyas: ["farmer", "vajra", "taksha"] });
}
