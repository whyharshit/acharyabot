# Farmer Acharya Project Details

Farmer Acharya is a mobile-first farming mentor app for Indian farmers, field workers, FPO members, agri trainees, and rural entrepreneurs. It combines short learning modules, AI crop guidance, voice conversations, quizzes, field work logs, progress tracking, farm tools, and an admin CMS.

## Stack

- Next.js 16 App Router
- React 19
- Tailwind CSS v4
- Zustand persisted client state
- Supabase service-role API routes
- Gemini/Claude-compatible AI routes
- Google TTS and Gemini Live voice mode

## App Structure

- `src/app/(app)` contains the learner app: home, learn, video, quiz, ask, apply, tools, and progress.
- `src/app/admin` contains the admin console.
- `src/app/api` contains server routes for content, auth, learners, admin, AI, and tools.
- `src/components/shell` contains navigation, language selection, and module selection.
- `src/lib/server` contains Supabase, auth, logging, and cache helpers.
- `supabase/migrations` contains database schema files.

## Authentication

Learners use phone OTP login.

- Pilot OTP is `123456`.
- `AUTO_CREATE_PILOT_USERS=true` allows any valid Indian phone number to be created during pilot testing.
- Learner sessions use an HTTP-only signed cookie.

Admins use a separate admin login at `/admin`.

- Bootstrap credentials can come from `.env.local`.
- Supabase-backed admin accounts live in `farmer_admin_accounts`.
- Admin sessions use the `farmer-admin-session` HTTP-only signed cookie.

Current local bootstrap admin credentials:

```txt
URL: /admin
Email: admin@farmer-acharya.app
Password: FarmerAcharya@123
```

Change this password before production.

## Database Tables

Initial schema:

- `farmer_users`
- `farmer_modules`
- `farmer_sections`
- `farmer_videos`
- `farmer_progress`
- `farmer_quiz_attempts`
- `farmer_chat_logs`
- `farmer_events`
- `farmer_apply_logs`
- `farmer_ai_usage`

Expansion schema:

- `farmer_admin_accounts`
- `farmer_quiz_bank`
- `farmer_diary_entries`
- `status` columns for modules/videos

Apply migrations in order:

```bash
node scripts/apply-sql.js supabase/migrations/001_farmer_initial_schema.sql
node scripts/apply-sql.js supabase/migrations/002_farmer_admin_cms_tools.sql
```

The script needs `SUPABASE_PAT` in your environment.

## Main Features

Learner features:

- Trilingual UI: English, Hindi, Bengali
- 25 starter farming modules
- Ask tab with AI chat, TTS, and Gemini Live voice conversation
- Quiz tab with AI-generated practical questions
- Apply tab for field reports and AI feedback
- Tools tab with weather, mandi lookup, crop calendar, fertilizer calculator, and farm diary
- Progress tracking

Admin features:

- Dashboard
- Module and section editor
- Draft/review/published status
- Translation coverage visibility
- Video editor
- Quiz editor
- Learner list
- Phone user role promotion
- Supabase admin account creation
- Chat logs
- Apply logs
- Event logs
- AI usage/cost view

## Environment Variables

Required for production-like operation:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
SESSION_SECRET=
NEXT_PUBLIC_ADMIN_EMAIL=
ADMIN_PASSWORD=
GEMINI_API_KEY=
GOOGLE_TTS_KEY=
```

Optional:

```env
ANTHROPIC_API_KEY=
GEMINI_LIVE_MODEL=gemini-3.1-flash-live-preview
DATA_GOV_API_KEY=
AUTO_CREATE_PILOT_USERS=true
```

`DATA_GOV_API_KEY` enables live mandi data. Without it, the mandi tool shows a setup note.

## Free Tool APIs

Weather uses Open-Meteo and does not need an API key.

Mandi prices use the Indian government data portal. It has a free API key.

Steps:

1. Go to `https://data.gov.in/`.
2. Create a free account or sign in.
3. Open your profile/API key page and copy the API key.
4. Add it to `.env.local`:

```env
DATA_GOV_API_KEY=your-free-data-gov-key
```

5. Restart the dev server:

```bash
npm run dev
```

## Development

```bash
npm install
npm run dev
npm run lint
npm run typecheck
npm run build
```

If port `3000` is already in use, stop the old process:

```bash
taskkill /PID <PID> /F
```

## Performance Notes

- Root layout is server-rendered and no longer wraps every route in the phone gate.
- The phone gate now lives only in the learner app layout.
- Admin pages can render without waiting for learner phone auth.
- Content routes use short memoized server-side caching.
- First load in `next dev` is slower than production because routes compile lazily.

## Safety Rules

Farmer Acharya must not invent pesticide, fungicide, herbicide, fertilizer, or medicine dosage. It should recommend label guidance and local agriculture officer/KVK advice when exact dosage is not available. Chemical spraying advice should include PPE and wind safety.
