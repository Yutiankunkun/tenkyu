# 天球 Tenkyu

小体量 VTuber 的本周直播时间表：主播自己维护，粉丝和运营一页看全。https://tenkyu.app

- Stack: Next.js 16 (App Router) · React 19 · Tailwind v4 · Supabase (Postgres + magic-link auth) · Vercel.
- Dev: `pnpm install && pnpm dev` → http://localhost:3000. Checks: `pnpm typecheck`, `pnpm lint`, `pnpm build`.
- Env: copy `.env.example` to `.env.local` and fill the three Supabase values.
- DB migrations live in `supabase/migrations/`; apply them in the Supabase SQL editor.
