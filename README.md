# FairMeet

Find the fairest meeting spot for a group — venues are ranked by minimizing the
*worst* travel time across every participant, then balanced for everyone's
preferences (categories, budget, rating, dietary keywords).

## Tech stack

- **Frontend:** React 18, Vite, TypeScript, Tailwind CSS, shadcn/ui
- **Backend:** Supabase (Postgres, Auth, Realtime, Edge Functions)
- **Maps:** Google Places API (New) + Distance Matrix API
- **AI:** Google Gemini (`gemini-2.5-flash`) for idea/theme suggestions

## Local development

```sh
npm install
npm run dev
```

The app expects a `.env` file (see `.env.example`):

```
VITE_SUPABASE_PROJECT_ID="..."
VITE_SUPABASE_URL="https://<project>.supabase.co"
VITE_SUPABASE_PUBLISHABLE_KEY="sb_publishable_..."
```

## Edge functions

Deployed to Supabase: `calculate-midpoint`, `suggest-ideas`, `brainstorm-theme`.

Required Edge Function secrets:

- `GOOGLE_MAPS_API_KEY` — Places API (New) + Distance Matrix (used by `calculate-midpoint`)
- `GEMINI_API_KEY` — Gemini API (used by `suggest-ideas` and `brainstorm-theme`)

## Scripts

- `npm run dev` — start the dev server
- `npm run build` — production build
- `npm run lint` — lint
- `npm test` — run tests
