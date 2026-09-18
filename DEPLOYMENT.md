# Deploying FRAME Beta

Target architecture — nothing more than the beta needs:

```
Frontend  →  Vercel        (static Vite build)
Backend   →  Railway       (Node 22+, one instance)
Database  →  Supabase      (Postgres + Auth)
AI        →  OpenRouter    (one developer key, server-side)
```

Work through this in order. Steps 1–4 are setup, 5–7 are deploys, 8–9 verify.

Anywhere you see `<…>`, substitute your own value. **Every value below is a
secret except `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY` and `APP_URL`.**

---

## 0. Push to GitHub first

From the repo root:

```bash
# Confirm nothing secret is staged. This must print nothing.
git status --porcelain | grep -E '^\?\? \.env$|settings\.json|frame\.db' || echo "clean"

git add -A
git commit -m "FRAME Beta — hosted AI, BYOK, Supabase, demo mode"

# If you have no remote yet:
gh repo create frame --private --source=. --remote=origin --push
# …or, without the gh CLI:
#   git remote add origin git@github.com:<you>/frame.git
#   git push -u origin master
```

`.gitignore` already excludes `.env`, `data/` (your local database **and** any
stored local API key) and `dist/`. Do not remove those lines.

---

## 1. Supabase setup

1. Create a project at <https://supabase.com/dashboard>. Choose a region near
   your users and save the database password it generates — you need it in
   step 2.
2. **Settings → API**, copy:
   - `Project URL` → `SUPABASE_URL`
   - `anon` / `publishable` key → `SUPABASE_PUBLISHABLE_KEY`
   - `service_role` / `secret` key → `SUPABASE_SECRET_KEY`
3. **Settings → Database → Connection string → URI**, copy it and substitute
   your password for `[YOUR-PASSWORD]` → `DATABASE_URL`.
   Use the **Session pooler** string (port `6543`) if your host is serverless;
   the direct string (port `5432`) is fine for Railway/Render.

> `service_role` bypasses Row Level Security. It belongs in the backend's
> environment and nowhere else — never in the frontend, never in git.

---

## 2. Database migration

The schema and its RLS policies are one idempotent file. Run it once:

```bash
psql "<DATABASE_URL>" -f supabase/migrations/0001_init.sql
```

No `psql`? Paste the file into **Supabase → SQL Editor** and run it.

It creates 21 tables, enables RLS on all of them, and installs 56 policies.
Re-running it is safe — every statement is `IF NOT EXISTS` or `DROP`-then-
`CREATE`.

Verify:

```sql
select count(*) from pg_policies where schemaname = 'public';   -- 56
select tablename from pg_tables
  where schemaname = 'public' and rowsecurity = false;          -- 0 rows
```

If that second query returns any row, that table is exposed through Supabase's
API without protection. Do not go live until it returns nothing.

---

## 3. Authentication

**Supabase → Authentication → URL Configuration:**

- **Site URL** — `<APP_URL>` (e.g. `https://frame.vercel.app`)
- **Redirect URLs** — add both:
  - `<APP_URL>`
  - `<APP_URL>/**`

**Authentication → Providers:**

- **Email** is on by default. Leave "Confirm email" on for a public beta.
- **Google** (optional): create an OAuth client in Google Cloud Console, set the
  authorised redirect URI to `<SUPABASE_URL>/auth/v1/callback`, and paste the
  client id and secret into Supabase. Skip this and the "continue with Google"
  button simply returns an error; email/password is unaffected.

---

## 4. OpenRouter setup

1. Create a key at <https://openrouter.ai/keys> → `OPENROUTER_API_KEY`.
2. Add credit to the account. **This key is yours and every beta user's hosted
   request spends your balance** — that is exactly why `BETA_DAILY_AI_LIMIT`
   exists.
3. Confirm the model id you want at <https://openrouter.ai/models>.
   Default is `anthropic/claude-opus-5`.
4. Consider setting a hard spend limit on the key in the OpenRouter dashboard.
   It is the only real backstop if the daily limit is misconfigured.

---

## 5. Backend deployment (Railway)

1. <https://railway.app> → **New Project → Deploy from GitHub repo** → pick this
   repo.
2. **Settings → Start Command:** `npm start`
3. **Settings → Networking → Generate Domain.** Note it — this is your
   `VITE_API_URL` in step 6.
4. **Variables** — paste all of these:

   ```
   NODE_ENV=production
   OPENROUTER_API_KEY=<from step 4>
   OPENROUTER_MODEL=anthropic/claude-opus-5
   BETA_DAILY_AI_LIMIT=20
   AI_RATE_LIMIT_PER_MINUTE=12
   SUPABASE_URL=<from step 1>
   SUPABASE_PUBLISHABLE_KEY=<from step 1>
   SUPABASE_SECRET_KEY=<from step 1>
   DATABASE_URL=<from step 1>
   APP_URL=<your Vercel URL, from step 6>
   ```

   `PORT` is supplied by Railway; do not set it.

   You do not have `APP_URL` yet on the first pass. Deploy the frontend first if
   you prefer, or set it after step 6 and redeploy — **CORS will reject the
   frontend until `APP_URL` is correct**, so it must be set before you test.

5. Deploy. Check the log for:

   ```
   [frame] api  http://0.0.0.0:8080  env=production mode=cloud hostedAI=anthropic/claude-opus-5
   ```

   `mode=local` means one of the four Supabase variables is missing or
   misspelled — cloud mode requires `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`
   **and** `DATABASE_URL` together.

Render, Fly and equivalents work the same way: Node 22+, `npm start`, same
variables.

---

## 6. Frontend deployment (Vercel)

1. <https://vercel.com/new> → import the repo.
2. Framework preset **Vite**. Build `npm run build`, output `dist`.
3. **Environment Variables** — exactly one:

   ```
   VITE_API_URL=https://<your-railway-domain>
   ```

   No trailing slash, no `/api`.
4. Deploy, then copy the resulting URL back into Railway's `APP_URL` and
   redeploy the backend.

Nothing else is baked into the bundle. Which Supabase project to use arrives at
runtime from the backend's `/api/meta`, so rotating Supabase keys never needs a
frontend rebuild.

---

## 7. CORS and APP_URL

The backend answers CORS for exactly one origin in production: `APP_URL`. In
development it additionally allows `http://localhost:5180`.

Symptoms of getting this wrong:

| Symptom | Cause |
|---|---|
| Every request fails, console says CORS | `APP_URL` missing or has a trailing slash |
| Works on the Vercel production URL, fails on a preview URL | Preview deploys have a different origin; add it to `APP_URL` or test on production |
| Sign-in redirects to the wrong place | Supabase **Site URL** does not match `APP_URL` |

---

## 8. Production smoke test

Run these against the live deployment.

```bash
API=https://<railway-domain>
APP=https://<vercel-domain>

# 1 — the backend is up and says so without leaking anything
curl -s $API/health
#    {"ok":true,"service":"frame"}

# 2 — cloud mode is really on
curl -s $API/health/ai
#    {"ok":true,"service":"frame","hosted":true,"mode":"cloud"}

# 3 — no secret is reachable from the browser's view of the world
curl -s $API/api/meta | grep -Ei 'service_role|sk-ant|sk-or|postgres://|SECRET' \
  && echo "LEAK — STOP" || echo "meta clean"

# 4 — the demo film exists and opens without a key or an account
DEMO=$(curl -s $API/api/demo | sed -E 's/.*"id":"([^"]*)".*/\1/')
curl -s $API/api/projects/$DEMO | head -c 200

# 5 — the demo is read-only to everyone
curl -s -X PATCH $API/api/projects/$DEMO \
  -H 'content-type: application/json' -d '{"name":"hacked"}'
#    {"error":"The demo film is read-only. …","code":"demo_readonly", …}

# 6 — a private project is not reachable anonymously
curl -s -o /dev/null -w '%{http_code}\n' $API/api/projects
#    401
```

Then in the browser at `$APP`:

- [ ] The landing page shows **FRAME BETA** and the pipeline.
- [ ] **Try FRAME** opens the demo film. No account, no key, no errors.
- [ ] The demo shows scenes, shots and composed prompts in the Prompt Lab.
- [ ] Create an account → confirm by email → sign in.
- [ ] Create a film, write an idea, refresh the browser — the work is still there.
- [ ] Run an AI action. The topbar `ai` counter reads `openrouter`.
- [ ] Settings shows your usage incrementing toward the daily limit.
- [ ] Open a private window, sign up as a second user — you cannot see the
      first user's film in the picker, and fetching its id directly returns 404.

---

## 9. Rollback

The backend is stateless; Railway's **Deployments → Redeploy** on a previous
build is a complete rollback. Nothing in the migration drops or rewrites data,
so no database rollback is needed for an application revert.

---

## Local development is unchanged

```bash
npm install
npm run dev
```

With no `.env`, FRAME runs exactly as it did before the beta: SQLite in
`data/frame.db`, no sign-in, structural AI. Set `ANTHROPIC_API_KEY` in `.env`
for a real model locally. You never need Supabase to develop.
