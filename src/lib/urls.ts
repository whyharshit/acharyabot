/**
 * Centralized URL configuration.
 *
 * All URLs are read from environment variables so that when URLs change,
 * you only need to update .env.local — no code changes required.
 *
 * If you add a new external service or web app URL, add it here and in
 * .env.local / .env.local.example.
 */

import { AcharyaSlug } from "./system-prompts";

// ── Acharya Web App URLs ────────────────────────────────────────────────────

export const APP_URLS: Record<AcharyaSlug, string> = {
  farmer: process.env.FARMER_APP_URL || "https://farmer-archarya-app.vercel.app",
  vajra: process.env.VAJRA_APP_URL || "https://vajra-acharya-mket.vercel.app",
  taksha: process.env.TAKSHA_APP_URL || "https://taksha-acharya.vercel.app",
};

// ── Video URLs ──────────────────────────────────────────────────────────────

/**
 * Base URL for video links sent in the bot.
 * Default: YouTube watch page. Change this env var to switch platforms
 * (e.g. https://youtu.be/ for short links, or a custom video CDN).
 */
export const VIDEO_BASE_URL =
  process.env.VIDEO_BASE_URL || "https://www.youtube.com/watch?v=";

/**
 * Video page path on the Acharya web apps.
 */
export const VIDEO_PAGE_PATH = process.env.VIDEO_PAGE_PATH || "/video";

// ── External API URLs ───────────────────────────────────────────────────────

/** Open-Meteo weather forecast endpoint */
export const WEATHER_API_URL =
  process.env.WEATHER_API_URL || "https://api.open-meteo.com/v1/forecast";

/** data.gov.in mandi / commodity prices endpoint */
export const MANDI_API_URL =
  process.env.MANDI_API_URL ||
  "https://api.data.gov.in/resource/9ef84268-d588-465a-a308-a864a43d0070";

// ── Telegram API ────────────────────────────────────────────────────────────

/** Telegram Bot API base URL (rarely changes, but kept here for completeness) */
export const TELEGRAM_API_BASE =
  process.env.TELEGRAM_API_BASE || "https://api.telegram.org";

// ── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Build a fully-qualified link to an Acharya web app.
 */
export function appLink(acharya: AcharyaSlug, path = "/"): string {
  return new URL(path, APP_URLS[acharya]).toString();
}

/**
 * Build a video watch URL given a video id and optional start time.
 */
export function videoLink(
  videoId: string,
  startSeconds?: number | null,
): string {
  const url = new URL(`${VIDEO_BASE_URL}${videoId}`);
  // For YouTube, start time is a query param; other platforms may differ.
  if (startSeconds) {
    url.searchParams.set("t", `${startSeconds}s`);
  }
  return url.toString();
}
