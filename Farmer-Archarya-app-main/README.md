# Farmer Acharya

Practical farming mentor app for Indian farmers, field workers, agri trainees, FPO members, and rural entrepreneurs. The app is forked from `arjun-acharya-app` and keeps the same clean mobile-first learning experience: modules, AI chat, quizzes, voice, progress tracking, phone login, and admin tools.

## What This Is

Farmer Acharya is a trilingual farming guide. English is the default language, with Hindi and Bengali supported. The first version focuses on practical crop learning: soil, seeds, nursery, irrigation, nutrients, pests, diseases, harvest, post-harvest handling, market basics, and farm records.

## Stack

Next.js 16 + React 19 + Tailwind v4 + Supabase + Anthropic Claude Sonnet for chat + Claude Haiku for quiz + Google TTS for voice.

## Supabase Setup

Farmer Acharya uses its own standalone tables in the new Supabase project. It does not use the Arjun/Gurukul database model.

Main tables:

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

Apply the schema:

```bash
# Option A: paste this file into Supabase SQL Editor
supabase/migrations/001_farmer_initial_schema.sql

# Option B: use the Management API with a Supabase personal access token
$env:SUPABASE_PAT="sbp_..."
node scripts/apply-sql.js supabase/migrations/001_farmer_initial_schema.sql
```

For local pilot login, `.env.local` can set:

```env
AUTO_CREATE_PILOT_USERS=true
```

Then any valid Indian phone number can be auto-created during OTP login. The pilot OTP is `123456`. Set `AUTO_CREATE_PILOT_USERS=false` for production and create users/admins deliberately.

## Starter Curriculum

The starter app is designed around these modules:

1. Welcome to Farmer Acharya
2. Know Your Farm
3. Soil Health Basics
4. Soil Testing and Soil Health Card
5. Seed Selection
6. Seed Treatment and Nursery Raising
7. Land Preparation
8. Sowing and Transplanting
9. Irrigation Basics
10. Drip, Sprinkler, and Water Saving
11. Fertilizer Basics
12. Compost, FYM, and Vermicompost
13. Weed Management
14. Pest Identification
15. Disease Identification
16. Integrated Pest Management
17. Safe Pesticide Use and PPE
18. Crop Calendar Planning
19. Vegetable Farming Basics
20. Paddy/Rice Basics
21. Wheat, Maize, and Pulses
22. Horticulture and Fruit Crops
23. Post-Harvest Handling
24. Market Linkage and Better Selling
25. Farm Records, Costing, and Profit

## Dev

```bash
npm install
npm run dev
npm run typecheck
npm run build
```

## Current Status

This repo currently has the Farmer Acharya app shell and AI identity. Supabase content seed/schema will be connected after project credentials and table strategy are finalized.
