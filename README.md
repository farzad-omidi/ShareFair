# ShareFair

A fair, transparent way to split shared expenses with roommates, partners, family, or a
trip crew — real accounts, real-time sync across devices, and a warm, calm design.

Built with Next.js (App Router), Supabase (Postgres + Auth + Realtime), and no other
backend to run.

## Features

- **Magic-link sign-in** — no passwords.
- **Spaces** — separate shared places for a home, a trip, roommates, family. Invite
  people with a shareable link/code.
- **Fair splitting** — equal, percentage, shares, or custom-amount splits, with credits
  and refunds.
- **Settle up** — a debt-simplification algorithm reduces balances to the minimum number
  of payments, with a transparent "why this amount" breakdown per person.
- **Rhythm / insights** — monthly averages, a spending chart, and category breakdowns,
  with an "excluding housing" toggle.
- **Real-time** — every device in a space sees changes live via Supabase Realtime.
- **Installable PWA** — add to your home screen on iOS/Android.
- **CSV export** for backups.

## Getting started

1. Copy `.env.example` to `.env.local` and fill in your Supabase project's URL and anon
   (publishable) key:

   ```bash
   cp .env.example .env.local
   ```

2. Apply the database schema in `supabase/schema.sql` to your Supabase project (via the
   SQL editor, the Supabase CLI, or the MCP `apply_migration` tool). It creates all
   tables, row-level security policies, and the `create_space` / `create_invite` /
   `redeem_invite` RPCs the app relies on.

3. Install dependencies and run the dev server:

   ```bash
   npm install
   npm run dev
   ```

   Open [http://localhost:3000](http://localhost:3000).

## Architecture

- `src/lib/domain.ts` — pure functions for splitting, running balances, and debt
  simplification. No I/O, fully unit-testable.
- `src/lib/store.tsx` — the `SpaceProvider` client context: loads a space's members,
  categories, and entries, subscribes to Realtime changes, and exposes mutations
  (add/edit/delete entries, settle up, manage spaces & invites).
- `src/lib/supabase/` — browser, server, and proxy (middleware) Supabase clients per the
  `@supabase/ssr` cookie-based session pattern.
- `src/components/views/` — the five main screens (Add, Month, Settle, Insights, More).
- Database access is entirely row-level-security-scoped: a user can only read or write
  data for spaces they are a member of (see `supabase/schema.sql`).

## Deploying

Deploy to [Vercel](https://vercel.com/new) (or any Next.js host) and set the two
`NEXT_PUBLIC_SUPABASE_*` environment variables from `.env.example` in your hosting
provider's dashboard.
