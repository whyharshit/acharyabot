// Create bot_sessions table via direct Postgres connection using Supabase pooler
// Uses dynamic import of 'pg' module
import { createRequire } from 'module';
import { execSync } from 'child_process';

// Install pg temporarily
try {
  execSync('npm list pg 2>&1', { stdio: 'pipe' });
} catch {
  console.log('Installing pg temporarily...');
  execSync('npm install --no-save pg', { stdio: 'inherit' });
}

const require = createRequire(import.meta.url);
const { Client } = require('pg');

const sql = `
CREATE TABLE IF NOT EXISTS public.bot_sessions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  telegram_user_id bigint NOT NULL UNIQUE,
  acharya_slug text CHECK (acharya_slug IN ('farmer', 'vajra', 'taksha')),
  preferred_lang text DEFAULT 'en' CHECK (preferred_lang IN ('en', 'hi', 'bn')),
  learner_id text,
  state_json jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.bot_sessions ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'bot_sessions' AND policyname = 'Service role full access on bot_sessions'
  ) THEN
    CREATE POLICY "Service role full access on bot_sessions"
      ON public.bot_sessions FOR ALL TO service_role
      USING (true) WITH CHECK (true);
  END IF;
END $$;

COMMENT ON TABLE public.bot_sessions IS 'Stores Telegram bot session state per user for persistence across serverless invocations.';
`;

async function run() {
  // Supabase direct connection (transaction mode via pooler port 5432)
  const client = new Client({
    host: 'aws-0-ap-south-1.pooler.supabase.com',
    port: 5432,
    database: 'postgres',
    user: 'postgres.jxztbmckfsvjragbfcir',
    password: process.env.SUPABASE_DB_PASSWORD || 'YOUR_DB_PASSWORD_HERE',
    ssl: { rejectUnauthorized: false },
  });

  try {
    console.log('Connecting to Supabase Postgres...');
    await client.connect();
    console.log('Connected. Running migration...');
    await client.query(sql);
    console.log('✅ bot_sessions table created successfully!');

    // Verify
    const res = await client.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'bot_sessions' ORDER BY ordinal_position");
    console.log('\nTable columns:');
    for (const row of res.rows) {
      console.log(`  ${row.column_name}: ${row.data_type}`);
    }
  } catch (err) {
    console.error('❌ Migration failed:', err.message);
    console.log('\nIf authentication failed, please run the SQL manually in the Supabase Dashboard:');
    console.log('https://supabase.com/dashboard/project/jxztbmckfsvjragbfcir/sql/new');
    console.log('\nSQL to run:');
    console.log(sql);
  } finally {
    await client.end();
  }
}

run();
