# FairMeet — project memory

## ⚠️ Branch mix-up (READ FIRST)

This repo has **two long-lived, diverged branches**. They forked on 2026-05-12
(`756af56`) and each has unique work:

- **`master`** — the **LIVE** branch. Cloudflare Pages deploys it via the Git
  connector. Production: `fairmeet-2x6.pages.dev`; branch alias:
  `master.fairmeet-2x6.pages.dev`. This is the **source of truth**. It was the
  Lovable-era line and is already Lovable-free in code (native Supabase Google
  OAuth; AI features on **Google Gemini** `gemini-2.5-flash`).
- **`main`** — the GitHub **default** branch, where earlier Claude PRs (#1, #2,
  #5, #6) merged. **Cloudflare does NOT deploy `main`.** It has its own infra
  (CI, migration files, realtime hook, ErrorBoundary, ResetPassword, etc.) and
  had Lovable removed in PR #6 — but that work never went live because the live
  branch is `master`.

**Consequence:** merging to `main` does nothing to the live site. Work that must
ship has to land on **`master`**. We are porting `main`'s useful extras onto
`master` (this is the agreed direction). Don't "fix" the live site by pushing to
`main`.

## Deploy
- Cloudflare Pages, Git connector, production branch = **`master`**. Build uses
  npm (package-lock.json) → `npm run build` → `dist/`. `public/_redirects`
  provides SPA fallback.
- Note: `master` still carries `bun.lock`/`bun.lockb` pinned to Lovable's
  private registry — the last Lovable remnant, not yet removed (out of scope so
  far). `package-lock.json` is the canonical lockfile.

## Backend (shared by both branches)
- Supabase project **`ntdxzuochwwrdezfrwuq`** ("Fairmeet", ap-southeast-1).
  Both branches point at the same project, so the **DB schema is shared/live**.
- Already applied to the live DB: `message_reactions` table; `participants.
  transport_mode`; `supabase_realtime` publication includes
  `venue_suggestions, participants, poll_votes, meetups, message_reactions,
  chat_messages`. So realtime/reactions need **no DB migration** — code only.
- `master` has **no `supabase/migrations/` files** (schema managed outside git).
  Do NOT add migration files to `master` PRs — the "Supabase Preview" check
  applies them to a fresh preview DB and they'd fail (they reference base
  tables/functions not created in those files).
- Edge functions on `master`: `calculate-midpoint`, `suggest-ideas`,
  `brainstorm-theme` (Gemini). Secrets: `GOOGLE_MAPS_API_KEY`, `GEMINI_API_KEY`.
- ⚠️ **Cloudflare does NOT deploy edge functions** — only the frontend (`dist/`).
  Edge functions must be deployed separately via the Supabase MCP tool
  (`deploy_edge_function`, project `ntdxzuochwwrdezfrwuq`) or the Supabase CLI
  (`supabase functions deploy <slug>`). **Git source ≠ live deployed version**
  unless you explicitly deploy. Current deployed versions: `calculate-midpoint`
  v16 (Places API New, `places.googleapis.com/v1/places:searchText`), `suggest-ideas`
  v3, `brainstorm-theme` v3.
- `calculate-midpoint` requires **"Places API (New)"** enabled in Google Cloud
  (the legacy `nearbysearch` was sunset; the function was migrated to the new API
  in git but had never been deployed — that was the "No venues found nearby" bug
  fixed on 2026-05-20). The API key must allow server-side calls (no HTTP-referrer
  restriction).

## Auth
- Native Supabase: email/password, anonymous **guest join**, Google OAuth
  (provider verified enabled & working in auth logs). No Lovable auth.

## Conventions
- `git push -u origin <branch>`; open a **draft** PR if none exists.
- Target **`master`** for anything that should go live; use a feature branch +
  PR into `master` (don't commit straight to `master`).
- Keep CI green: `npm run lint` (0 errors), `npm run type-check`, `npm run test`,
  `npm run build`.
