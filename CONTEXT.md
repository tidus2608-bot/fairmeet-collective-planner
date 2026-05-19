# FairMeet Collective Planner — Agent Handoff

## Project
React 18 + TypeScript + Vite + Tailwind/shadcn/ui. Backend is Supabase
(Postgres + RLS + Edge Functions + Realtime + Auth). Server state via
TanStack React Query v5. Maps/venues via Google Places + Distance Matrix.

## Current state
PR #1 (`claude/improve-venues-chat-rUDsc`) is **merged into `main`**. CI
(`verify`: lint + type-check + test + build) is green. Two rounds of work
shipped:

**Round 1 — Venues & Chat**
- Fixed broken venue discovery: `useAddVenues` was inserting the edge
  function's raw output (invalid `id`, non-column fields), so every search
  silently fell back to hardcoded Hanoi mocks. Now maps valid columns only.
- Venues: real error toasts, richer cards (photos, price, open-now,
  website/phone), fairness sorting, manual entry, removal, refresh.
- Chat: optimistic send + retry, avatars, grouping, date separators,
  emoji reactions, typing indicators, unread badge.

**Round 2 — App-wide**
- Invite/join flow (was fully broken — `/join/:code` 404'd): new
  `/join/:code` route + `JoinMeetup` page, `join_meetup_by_code`
  SECURITY DEFINER RPC, dashboard "Join with a code" entry, tightened
  `participants` INSERT RLS (organizer-only direct insert).
- Security: Google Maps key moved to `VITE_GOOGLE_MAPS_API_KEY`;
  `calculate-midpoint` redeployed with `verify_jwt: true` + payload
  validation; React `ErrorBoundary`; `.env*.local` git-ignored.
- Scheduling/account: `meetups.scheduled_at` column, organizer rename,
  `.ics` calendar export; password reset flow; profile name editing.
- Code health: 21 ESLint errors → 0; dead Zustand store removed; CI
  workflow + `type-check` script added; bundle code-split into vendor
  chunks (no more 809 KB warning).

## Supabase / deploy state
- Active project: **`ntdxzuochwwrdezfrwuq`** (`.env` + `supabase/config.toml`
  point here; an older stale project `ldddmqukzfnbjyaipjbt` is abandoned).
- Migrations applied: venue/chat columns + `message_reactions`;
  `20260519130000_app_improvements` (`join_meetup_by_code`, tightened
  participants RLS, `meetups.scheduled_at`).
- `calculate-midpoint` edge function: v15, `verify_jwt: true`.
- Secrets set on the project: `GOOGLE_MAPS_API_KEY` (server-side, for the
  edge function), `GEMINI_API_KEY`.

## Open follow-ups
- Add HTTP-referrer restrictions to the public Maps key in Google Cloud
  Console (code can't enforce this — client keys are visible in the bundle).
- PR #1 test plan has unchecked manual items: invite flow end-to-end,
  non-organizer cannot self-add, calendar `.ics` download, password reset,
  profile name edit.

## Key files
- `src/hooks/useMeetups.ts` — all meetup/venue/chat queries & mutations
- `src/hooks/useAuth.tsx` — auth incl. `resetPassword`
- `src/App.tsx` — lazy routes, `/join/:code`, `/reset-password`, ErrorBoundary
- `src/pages/JoinMeetup.tsx`, `src/pages/ResetPassword.tsx`
- `src/components/meetup/OverviewTab.tsx` — date/time, rename, calendar export
- `src/components/meetup/VenuesTab.tsx`, `src/lib/venue.ts`
- `src/lib/calendar.ts` — `.ics` generation
- `supabase/functions/calculate-midpoint/index.ts` — venue discovery
- `supabase/migrations/` — schema history

## Available MCP connectors (use proactively to automate)
- **Supabase MCP**: `apply_migration`, `execute_sql`, `deploy_edge_function`,
  `generate_typescript_types`, `list_tables`, `get_logs`, `get_advisors`.
- **GitHub MCP** (`mcp__github__*`): scoped to
  `tidus2608-bot/fairmeet-collective-planner` only. PRs, issues, branches,
  CI check runs, review comments. Create PRs as drafts after pushing.
- Also available: Slack, Google Calendar, Google Drive, Gmail, Figma,
  Jira/Confluence, Cloudflare.

## Working conventions
- Develop on branch `claude/improve-venues-chat-rUDsc`; never push to a
  different branch without explicit permission.
- `git push -u origin <branch>`; create a draft PR if none exists.
- CI must stay green (`npm run lint` 0 errors, type-check, test, build).
- User preference: utilize all connectors/MCP to automate tasks proactively.
