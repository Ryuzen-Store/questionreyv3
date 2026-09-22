# QuestionRy Multi Quest

**Tantangan Kuis Dinamis & Realtime** — a production-ready, static web quiz
platform with Supabase Auth + Realtime, a multi-provider AI question engine,
neobrutalist UI, and a secure owner-only admin panel.

> Deployable to Netlify as-is. No build step required.

---

## 1. Tech Stack

| Layer        | Choice                                                                |
|--------------|-----------------------------------------------------------------------|
| Markup       | HTML5 (semantic), inline SEO/OG metadata                              |
| Styling      | CSS3, hand-written neobrutalist design system (no framework)          |
| Logic        | Vanilla JavaScript **ES Modules**                                     |
| Backend      | Supabase (Auth, Postgres + RLS, Realtime)                             |
| AI generation| 3 REST providers called **in parallel**, first VALID result wins      |
| Hosting      | Netlify static (hash router + `_redirects` SPA fallback)              |

No React / Vue / Svelte / Next / Nuxt / Angular. No Tailwind. One repository,
many small modules.

---

## 2. Project Structure

```
QuestionRy-Multi-Quest/
├── index.html            # entry + inline SEO/OpenGraph/Twitter metadata
├── netlify.toml          # static publish + SPA redirect rules
├── _redirects            # portable SPA fallback
├── README.md
├── supabase/
│   └── setup.sql         # schema, triggers, functions, RLS (run once)
│
├── assets/
│   ├── images/           # og-image.png, logo.svg, favicons
│   ├── icons/questionry-icons.svg   # monochrome SVG icon sprite
│   └── fonts/            # (empty — system font stack is used)
│
├── css/
│   ├── style.css         # tokens/reset/base/fields/toasts/modals
│   ├── neobrutalism.css  # buttons + hard shadows
│   ├── animations.css    # keyframes (reduced-motion aware)
│   ├── responsive.css    # mobile-first, NO fixed device widths
│   ├── auth.css          # auth gate + landing
│   ├── quiz.css          # select steps + arena + generation overlay
│   ├── result.css        # result + accordion pembahasan
│   ├── dashboard.css     # dashboard + history
│   ├── leaderboard.css
│   ├── profile.css       # profile + settings
│   └── admin.css         # admin login + dashboard + user table/cards
│
└── js/
    ├── app.js            # boot, auth state machine, page registration
    ├── config.js         # ⚠ ALL public config lives here
    ├── router.js         # hash router + auth gate
    ├── navigation.js     # drawer/nav coordinator
    ├── storage.js        # safe localStorage/sessionStorage wrapper
    ├── validation.js     # form + question shape validators
    ├── utils.js          # DOM / escape / format / debounce helpers
    │
    ├── data/bank.js      # subject taxonomy + local fallback question bank
    │
    ├── supabase/
    │   ├── client.js     # Supabase v2 bootstrap (anon key only)
    │   ├── auth.js       # session, sign-in/out, Google, guest
    │   ├── database.js   # all data-access (profiles/questions/logs/settings)
    │   └── realtime.js   # scoped postgres_changes subscriptions
    │
    ├── ai/
    │   ├── ai-engine.js  # orchestration: parallel race → retry → fallback
    │   ├── providers.js  # 3 REST provider adapters + AbortController
    │   ├── parser.js     # tolerant response parsing + normalization
    │   ├── failover.js   # DB catalog + local bank fallback
    │   └── cache.js      # localStorage quiz cache (48h TTL)
    │
    ├── quiz/
    │   ├── quiz.js       # pure quiz state machine
    │   ├── subjects.js   # 5 top-level subjects
    │   ├── levels.js     # Easy/Normal/Hard/Impossible
    │   ├── question-count.js
    │   ├── question-generator.js  # validation + watchdog wrapper
    │   ├── question-validator.js  # pre-quiz validation/normalization
    │   └── results.js    # draft persistence + quiz-log persistence
    │
    ├── pages/
    │   ├── landing.js · auth.js · subject-select.js · level-select.js
    │   ├── question-count-select.js · quiz-page.js · result-page.js
    │   ├── dashboard.js · leaderboard.js · profile.js · settings.js
    │   └── admin.js
    │
    └── components/
        ├── header.js · navigation.js · icons.js · card.js · button.js
        ├── modal.js · accordion.js · loading.js · toast.js · status.js
```

---

## 3. Local Development

```bash
# From the project root — any static file server works:
npx serve .               # or
python3 -m http.server 8080
# open http://localhost:8080
```

Because the Supabase URL and AI endpoints are HTTPS, opening with a plain
`file://` URL will break module loading (CORS). Always serve over HTTP(S).

---

## 4. Netlify Deployment

1. Push this directory to a Git repository.
2. In Netlify: **Add new site → Import from Git → Deploy**.
3. Build command: *(empty — no build step)*, Publish directory: `.`.
4. `netlify.toml` already contains the SPA redirect rules; `_redirects` is a
   portable duplicate for other hosts.

The hash router (`#/quiz`, `#/dashboard`, …) never touches the server. Direct
paths (`/`, `/woiapaitujir`, `/dashboard`, …) fall back to `/index.html` via
the redirect rules, so **`/woiapaitujir` opens correctly when visited
directly**.

---

## 5. Supabase Configuration

Project used by this app (public/publishable credentials — safe to ship):

- **URL**: `https://hdcrjriftlgezcvyxcgc.supabase.co`
- **anon/publishable key**: `sb_publishable_yErI-BHFSpPu6DEIYbNNzw_2mCu4zsW`

These live in **`js/config.js`** only. **Never add a
`SUPABASE_SERVICE_ROLE_KEY` to frontend code.**

Setup steps:

1. In the Supabase dashboard → SQL editor, run **`supabase/setup.sql`**.
   It creates `profiles`, `questions`, `quiz_logs`, `system_settings`, the
   `handle_new_user` trigger, the score-bump trigger, and all RLS policies.
2. **Auth → Providers**: enable **Google**; create OAuth credentials in the
   Google Cloud Console with the redirect URI shown in Supabase.
3. **Auth → URL Configuration**:
   - Site URL: ``
   - Redirect URLs: add `**`
4. Promote your own account to owner (after first login):
   ```sql
   update public.profiles set role = 'owner' where email = 'you@example.com';
   ```
5. Admin Google account: `ryuxzenn@gmail.com`. The SQL trigger assigns this exact email the `owner` role on new Auth accounts, and the frontend also requires the exact email. If the Google account already exists, run the one-time UPDATE included near the seed section in `supabase/setup.sql`.

6. (Optional) seed a system status row:
   ```sql
   insert into public.system_settings (key, value) values
     ('server_status','online'), ('ai_api_endpoint',''), ('ai_keys','[]')
   on conflict (key) do nothing;
   ```

### Database Schema

| Table | Columns |
|-------|---------|
| `profiles` | `id uuid PK→auth.users`, `email text`, `player_tag text unique`, `role app_role('player','owner')`, `score int`, `created_at`, `updated_at` |
| `questions` | `id serial`, `subject`, `topic`, `subtopic`, `difficulty`, `question_text`, `options jsonb`, `correct_index int`, `explanation`, `created_at` |
| `quiz_logs` | `id serial`, `user_id uuid`, `subject`, `difficulty`, `total_questions`, `correct_count`, `score`, `created_at` |
| `system_settings` | `key text PK`, `value text` — keys: `server_status`, `ai_api_endpoint`, `ai_keys` |

### Row Level Security (enforced server-side)

- `profiles`: public **read** (leaderboard shows only `player_tag/role/score`);
  users can **update only their own row** and cannot escalate their own role;
  **owners** can update roles.
- `questions`: public read; owner-only write.
- `quiz_logs`: insert only for `user_id = auth.uid()`; read own rows; owners
  read all rows.
- `system_settings`: public read (status only — see the security warning for
  `ai_keys`); owner-only write.
- A `security definer` trigger creates the profile row on sign-up, so the
  frontend never needs insert rights on `profiles`.

The frontend re-checks `profiles.role === 'owner'` for UX, but the **actual
authorization is RLS**. Hiding a page is never treated as security.

### Realtime

```js
// js/supabase/realtime.js
supabase.channel(...).on('postgres_changes', { event, schema:'public', table, filter }, cb).subscribe()
```

Scoped subscriptions (`player`, `admin`, `leaderboard`, `status`) are opened
only when needed and torn down on page cleanup. The header server-status badge
and the admin dashboard update automatically (no polling). Real-time requires
**Realtime enabled** on the tables in Supabase (Dashboard → Database →
Replication → enable for `profiles`, `quiz_logs`, `system_settings`) and the
`REPLICA IDENTITY` default.

---

## 6. AI Provider Configuration

Three REST providers are called **simultaneously**; the first response that
yields a **valid, complete** set of questions wins and the other in-flight
requests are aborted (AbortController):

| Provider | Endpoint |
|----------|----------|
| A (DeepSeek) | `https://anabot.my.id/api/ai/deepseek?prompt=&search_enabled=false&thinking_enabled=false&imageUrl=&auth=` |
| B (Gemini) | `https://anabot.my.id/api/ai/gemini3.5flash?prompt=&url=&webSearch=false&reasoning=true&auth=` |
| C (Perplexity) | `https://anabot.my.id/api/ai/perplexity?prompt=&auth=` |

Key pool (configured in `CONFIG.ai.keys`): `[REMOVED]`, `[REMOVED]_bk2`,
`[REMOVED]_bk3`. Keys are rotated round-robin per request.

**Engine flow** (see `js/ai/ai-engine.js`):

```
cache hit? ──► parallel providers (first valid wins)
   │              └► partial? split-retry for remaining questions
   └──► Supabase `questions` catalog
            └──► local fallback bank (js/data/bank.js)
```

Validation rejects: non-200/429/5xx, invalid JSON, wrong structure, wrong
subject, <4 options, bad correct index, empty explanations, obvious
duplicates. Timeouts, failover and the local bank guarantee the game never
crashes into an infinite loader.

---

## 7. Security Warnings (READ THIS)

### ⚠ Frontend keys are PUBLIC

Anything placed in `js/config.js` — including the Supabase anon key and the
**AI API keys** — is visible to every visitor. This is the explicit trade-off
required by the client-side-API project spec.

- The Supabase **anon key is fine to expose**; it is guarded by RLS.
- The **AI keys are NOT secret** in this configuration. If those keys are
  privileged, move them to the server:

### Recommended: Netlify Function proxy

```
Browser → Netlify Function (/netlify/functions/ai) → anabot.my.id
```

Store the AI keys in Netlify **environment variables** (e.g. `AI_KEYS`) and
remove them from `js/config.js`. The app already supports an endpoint override:
set the `ai_api_endpoint` row in `system_settings` and `CONFIG.ai.overrideEndpoint`
to the function URL.

### Never in frontend

- `SUPABASE_SERVICE_ROLE_KEY`
- private AI provider secrets
- anything you would not print in a brochure

### Admin route

`/woiapaitujir` shows only an **Admin Login**. No admin data, metrics or API
calls happen before Supabase Auth succeeds **and** `profiles.role === 'owner'`.
Role is re-read from the database (not localStorage / URL / client flags).
If the session expires, the admin state resets to the login screen.

---

## 8. Google Auth Redirect

Configured in `js/config.js`:

```js
auth: {
  siteUrl: '',
  localDevUrl: 'http://localhost:8080',
}
```

If the domain changes you must update **three places**:

1. `CONFIG.app.siteUrl` in `js/config.js`
2. Supabase **Auth → URL Configuration** (Site URL + Redirect URLs)
3. Optional: the OG `og:url` in `index.html`

---

## 9. Quiz Flow & Product Behavior

1. **Auth Gate** → Google / email+password / Guest (sandbox).
2. **START QUIZ** → **SELECT MAPEL** (Matematika / IPA / IPS / Sejarah /
   Informatika — only these five) → **SELECT LEVEL** (Easy / Normal / Hard /
   Impossible) → **SELECT QUESTION COUNT** (10/15/20/30/40/45).
3. **GENERATE** (parallel providers) → **QUIZ ARENA** (subject, difficulty,
   progress, timer, 4 options, BACK/NEXT; no explanations shown while playing).
4. **RESULT** → score/correct/incorrect/total/subject/difficulty → **PEMBAHASAN
   SOAL** accordion, **all closed by default** with `Buka Semua` / `Tutup Semua`.
   Explanations come from the original questions — **the AI is never called
   again** on the result page.
5. Dashboard / History / Leaderboard / Profile reflect the saved results; quiz
   logs are written to Supabase once (RLS: own rows only).

Difficulty genuinely shapes generation (prompt constraints per level), and for
counts > 20 a fraction of fundamentals are included automatically.

---

## 10. Accessibility & Performance

- Semantic HTML, real `<button>`s, keyboard focus, visible `:focus-visible`.
- `aria-expanded` on accordions, `aria-label` on icon-only buttons, decorative
  SVGs are `aria-hidden`.
- System font stack (no blocking font fetch), modular ES imports, debounced
  admin search, AbortController for AI races, cache for repeated quizzes,
  `prefers-reduced-motion` respected, no emojis (SVG icons only).

---

## 11. Admin Quick Start

1. Log in once as a normal user (Google/email).
2. Promote yourself:
   `update public.profiles set role = 'owner' where email = 'you@example.com';`
3. Open `woiapaitujir` → **Admin Login** with
   the same credentials.
4. You get: live metrics (users/online/quizzes/questions/score/sessions),
   server-status toggle, realtime user list, search, and per-user detail with
   quiz history.

---

## 12. Troubleshooting

| Symptom | Cause / Fix |
|---------|-------------|
| Icons missing | Serve over HTTP(S); the sprite is fetched at runtime |
| Supabase auth hangs | Check Site URL / redirect URLs; check console for `SUPABASE_UNAVAILABLE` |
| Admin denies access | `profiles.role` must be `owner`; RLS policies must be applied |
| AI generation falls back instantly | Providers may 429/500 → failover + local bank kicks in (by design) |
| No realtime updates | Enable Replication for the tables in Supabase dashboard |
| Email sign-up says "check email" | Email confirmation is on; confirm or disable it in Supabase |


## V4 changes
- Exact selected question count is enforced.
- Every generated question has 6 options A-F and exactly 2 correct answers.
- Admin path is `/jekirq2&`; this is only URL obscurity, not a security boundary.
- Owner account is exactly `ryuxzenn@gmail.com`; Google OAuth still authenticates the session.
- Roles: USER BIASA, ALBERT EINSTEIN (auto at 320 lifetime correct), MAHA RAJA/owner.
- Owner can view stored answer records. Run the updated `supabase/setup.sql`.
