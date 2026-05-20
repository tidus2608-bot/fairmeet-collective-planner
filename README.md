# FairMeet

Find the fairest meeting spot for everyone. Participants share where they're
coming from and how they travel; FairMeet suggests venues that minimise the total
(and most lopsided) travel burden across the group.

## Tech stack

- React + TypeScript + Vite
- Tailwind CSS + shadcn/ui
- Supabase (auth, Postgres, RLS)
- Google Maps (`@react-google-maps/api`)
- TanStack Query, Zustand

## Local development

```bash
npm install
npm run dev      # http://localhost:8080
```

Create a `.env` (see the existing variables) with your Supabase and Google Maps keys:

```
VITE_SUPABASE_URL=...
VITE_SUPABASE_PUBLISHABLE_KEY=...
VITE_SUPABASE_PROJECT_ID=...
```

## Scripts

```bash
npm run lint         # eslint
npm run type-check   # tsc --noEmit
npm run test         # vitest
npm run build        # production build to dist/
npm run preview      # serve the production build
```

## Deployment

The app is a static SPA built with Vite (`npm run build` → `dist/`) and deployed
via Cloudflare Pages' Git integration. `public/_redirects` provides the SPA
fallback so client-side routes survive a hard refresh.
