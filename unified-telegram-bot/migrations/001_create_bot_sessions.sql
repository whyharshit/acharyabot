-- Migration: Create bot_sessions table for Telegram bot session persistence (BUG-06 fix)
-- Run this on the Vajra Supabase project (shared / primary database)
--
-- This table stores per-user bot state so that sessions survive Vercel
-- serverless cold starts. Previously this state lived in in-memory Maps.

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

-- Index for fast lookups by telegram_user_id (covered by UNIQUE constraint)
-- No additional index needed.

-- Enable RLS (required by Supabase best practices)
ALTER TABLE public.bot_sessions ENABLE ROW LEVEL SECURITY;

-- Allow service_role full access (the bot uses service_role key)
CREATE POLICY "Service role full access on bot_sessions"
  ON public.bot_sessions
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Comment for documentation
COMMENT ON TABLE public.bot_sessions IS 'Stores Telegram bot session state per user. Used by the unified bot to persist acharya selection, language preference, and transient quiz/tool/apply state across serverless invocations.';
