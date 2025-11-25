# 🧭 WARP.md — Open Arena Agent Guide

Purpose
- Serve as the single source of truth for Warp agents working on this repo.
- Summarize project context, rules, key commands, file paths, and safe operating procedures.
- For complete details, see AGENTS.md (master document with full appendix).

Project at a glance
- Stack: Next.js 16 + React 19.2 + TypeScript + Tailwind CSS + Visx
- Backend/services: Supabase (Postgres + RLS), OpenRouter (LLMs), Aster DEX API
- Hosting: Vercel Pro (Cron Jobs enabled)
- App: src/app/page.tsx dashboard with tabs (ALL, 72H, COMPLETED TRADES, MODELCHAT, POSITIONS, README.TXT)
- API routes: src/app/api/{leaderboard,models,positions,reasoning,trades}

Repository rules (follow strictly)
1) Do not commit code unless explicitly asked.
2) Prefer git --no-pager for VCS commands; never run paged commands.
3) Handle secrets safely:
   - Load secrets into env vars; never echo or print them.
   - Use placeholders like {{CRON_SECRET}} in examples.
4) Always type-check before concluding tasks:
   - npx tsc -p . --noEmit
5) If a linter exists, run it; otherwise skip (no lint script in package.json today).
6) Next.js is configured for output: export; when adding dynamic routes, export generateStaticParams().
7) When reading/editing files, preserve existing patterns and formatting.
8) Only use server-side environment variables in API routes; never ship secrets to the client.

Environment variables (baseline)
- ASTER_API_KEY, ASTER_API_SECRET
- OPENROUTER_API_KEY
- NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY
- SUPABASE_SERVICE_ROLE_KEY (server only; used by cron and admin tasks)
- CRON_SECRET (protects cron endpoints)
See AGENTS.md → Setup Instructions for full details and examples.

Quick start
- Install: npm install
- Dev server: npm run dev (open http://localhost:3000)
- Type-check: npx tsc -p . --noEmit

Database setup
- Create Supabase project.
- Run migrations in supabase/migrations (see AGENTS.md for order and notes).
- Verify tables: models, trades, positions, model_reasoning, performance_snapshots, leaderboard.

Key scripts and endpoints
- scripts/test-aster-api.ts: Validates Aster API connectivity
  - npx tsx scripts/test-aster-api.ts
- Cron endpoints (call with Authorization: Bearer {{CRON_SECRET}}):
  - /api/cron/execute-trades (decision/open/close cycle)
  - /api/cron/monitor-positions (price updates and risk checks)
- Example local trigger:
  - curl -sS http://localhost:3000/api/cron/execute-trades -H "Authorization: Bearer {{CRON_SECRET}}"

Trading system parameters (defaults)
- Limiters (execute-trades/monitor-positions):
  - MAX_POSITION_SIZE_PERCENT ~ 0.35
  - MAX_OPEN_POSITIONS ~ 3
  - MIN_POSITION_SIZE_USD ~ 10 (varies by branch/phase)
  - MAX_LEVERAGE ~ 10
  - TAKE_PROFIT/STOP_LOSS: typically 3-5% / 2-3%
- Update these in the respective cron route files as needed.

Deployment (Vercel Pro)
- Ensure all env vars are set in Vercel dashboard.
- Cron jobs configured in vercel.json (e.g., */15 for trades, */5 for monitor).
- After changing schedules or server-side code, redeploy.

File/path reference
- Dashboard: src/app/page.tsx
- API routes: src/app/api/*/route.ts
- Aster client: src/lib/aster/{client.ts, websocket.ts, signature.ts}
- Trading agent: src/lib/trading/agent.ts
- Market snapshot: src/lib/market/snapshot.ts (if present)
- Utils: src/lib/utils/*
- Supabase client: src/lib/supabase.ts
- Types: src/types/index.ts
- Migrations: supabase/migrations/*.sql

Testing checklist for agents
- Can build/type-check? npx tsc -p . --noEmit
- Can start dev server? npm run dev
- Aster API reachable? npx tsx scripts/test-aster-api.ts
- Cron endpoints respond with valid JSON and proper auth header?
- Dashboard tabs render without runtime errors?

Safety and rollback
- Never modify or remove env handling.
- For risky changes, suggest isolated diffs and request user approval.
- Keep changes small and reviewable; prefer PR-sized edits.

Where to find more details
- AGENTS.md — master document with:
  - Full project overview and architecture diagrams
  - Database schema and helper functions
  - Live trading configuration and schedules
  - Consolidated appendices (Deployment, Trading System, Waitlist guides, Color palette, Dropdown fix, Multi-account setup, Pause/Resume, etc.)

Changelog for docs
- 2025-10-26: Initial WARP.md created from AGENTS.md to guide Warp agents.
