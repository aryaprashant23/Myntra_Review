# Master build prompt for Antigravity — Myntra Wishlist Discovery Engine

Paste everything below into Antigravity as your project brief. It is
structured in phases on purpose — ask Antigravity to complete and verify
each phase before starting the next one, rather than building everything
at once. This keeps the system debuggable and gives you a working,
demonstrable product at multiple checkpoints along the way, not just at
the very end.

---

## Project context (give this to Antigravity first)

I am building an AI-powered discovery engine that analyzes public feedback
to understand why users add fashion items to their Myntra wishlist but
don't purchase them. The system must run live and automatically, end to
end, using entirely free-tier infrastructure wherever possible. It has
four layers: data ingestion, AI normalization, a database, and a public
website. Build it in the phases below, in order. After each phase, tell
me what you built, how to verify it works, and wait for my confirmation
before moving to the next phase.

**Constraints:**
- Everything must run on free tiers: GitHub (public repo, free Actions
  minutes), Supabase (free Postgres project), Apify (free plan), Vercel
  (free hosting), and Groq (free-tier API for the AI normalization and
  chat steps, running an open model like Llama 3.3 at high speed with
  no cost at this project's scale).
- Direct scraping of Reddit and the Apple App Store is blocked by
  anti-bot protections, so those two sources must go through Apify's
  pre-built actors instead of custom scrapers. Play Store reviews have
  no such restriction and should be scraped directly (no Apify needed
  for that one).
- I am non-technical. After each phase, explain in plain language what
  was built and give me an exact, copy-pasteable checklist of any manual
  steps I need to do myself (creating accounts, getting API keys, adding
  secrets).
- The final product needs a public, testable URL and must stay live and
  self-updating without me needing to run anything manually day to day.

---

## Phase 1 — Accounts and foundation (no code yet)

Give me an exact checklist to create, in this order:
1. A free Supabase project (database).
2. A free Apify account (for Reddit and App Store scraping).
3. A free Groq API key (for the normalization step and chat panel) —
   sign up at console.groq.com, no payment method required, generous
   free-tier rate limits for this project's data volume.
4. A public GitHub repository for this project.
5. A free Vercel account, connected to that GitHub repo.

Do not write any code in this phase. Confirm I have all five before
proceeding, and list exactly which credential/key I'll need from each
one in later phases.

**Acceptance criteria:** I have five working free accounts and know
which key belongs to which future phase.

---

## Phase 2 — Database schema (Supabase)

Design and give me the SQL to create two tables in Supabase:

- `raw_feedback` — every scraped review/post/comment before cleaning.
  Columns: id, external_id (unique, prevents duplicates), platform
  (playstore / reddit / appstore), text, url, author, rating (nullable),
  keyword_matched, scraped_at.
- `insights` — the cleaned, tagged output the website will actually
  display. Columns: id, theme, theme_label, mention_count,
  pct_of_total, sample_quotes (array), segment_breakdown (jsonb),
  trend, updated_at.

Explain in plain terms why there are two tables instead of one (raw data
vs. cleaned data shouldn't mix, so the website only ever shows
trustworthy, processed information).

**Acceptance criteria:** Both tables exist in my Supabase project and I
can see them in the Supabase Table Editor.

---

## Phase 3 — Ingestion layer (three sources, two methods)

Build three separate, source-specific scripts, all writing into the
same `raw_feedback` table with keyword filtering for wishlist-related
terms (wishlist, wish list, save for later, saved item, bookmark, cart,
buy later, shortlist) applied before anything is saved:

**3a. Play Store (direct, no Apify needed)**
A Python script using `google-play-scraper` that pulls recent Myntra
app reviews directly — no login or third-party service required, since
Play Store has no anti-bot restriction on this.

**3b. Reddit (via Apify)**
Use an existing Apify actor from the Apify Store built for Reddit
scraping (search Apify Store for "Reddit Scraper"). Write a script that:
- Triggers a run of that actor via the Apify API, searching for
  "myntra wishlist" and related terms.
- Waits for the run to finish, then pulls the results via the Apify
  API's dataset endpoint.
- Filters for wishlist keywords and upserts matches into `raw_feedback`
  with platform = "reddit".

**3c. App Store (via Apify)**
Same pattern as 3b, but using an Apify actor built for App Store review
scraping (search Apify Store for "App Store Reviews Scraper"), targeting
the Myntra iOS app, with platform = "appstore".

All three scripts must use `on_conflict` upserts on `external_id` so
re-running them never creates duplicate rows.

**Acceptance criteria:** Running all three scripts once populates
`raw_feedback` with real rows from all three platforms, visible in
Supabase, with no duplicates on a second run.

---

## Phase 4 — Automation (make ingestion run itself, daily)

Build a GitHub Actions workflow (`.github/workflows/ingest.yml`) that:
- Runs once a day on a schedule, plus supports manual triggering.
- Installs dependencies and runs all three Phase 3 scripts in sequence.
- Reads all credentials (Supabase URL/key, Apify API token, Reddit/App
  Store actor IDs) from GitHub Secrets — never hardcoded in the code.

Give me the exact list of GitHub Secrets to add and where to get each
value from (Supabase dashboard, Apify dashboard, etc.).

**Acceptance criteria:** I can go to the GitHub Actions tab, click "Run
workflow" manually, and watch it successfully add new rows to
`raw_feedback` without me running anything on my own computer.

---

## Phase 5 — AI normalization and tagging (Groq-hosted Llama)

Build a script that:
- Reads rows from `raw_feedback` that haven't been processed yet.
- Sends each one to the Groq API (using a current Llama 3.3 or similar
  instruction-tuned model available on Groq) with a prompt that
  (a) discards irrelevant/noise content, (b) tags relevant content by
  theme (fit uncertainty, price-wait, styling doubt, occasion-timing,
  social validation, or other — let the model propose new themes if a
  clear pattern doesn't fit these), and (c) extracts the clearest
  supporting quote. Request structured JSON output so results parse
  reliably.
- Aggregates results into the `insights` table: counts per theme,
  percentage of total blocked-purchase mentions, segment breakdown
  where inferable, and a few representative sample quotes per theme.
- Runs as a second step in the same GitHub Actions workflow from Phase
  4, right after ingestion, so the whole pipeline — scrape, clean, tag
  — happens automatically every day.
- Includes basic retry/backoff handling, since free-tier APIs enforce
  rate limits that a daily batch job can hit if run too quickly.

Explain, in plain terms, whether this stays within Groq's free-tier
limits given the expected daily data volume, and what happens if a
batch is large enough to hit those limits (e.g. spreading the job
across a longer window, or processing in smaller chunks).

**Acceptance criteria:** After a full pipeline run, `insights` contains
real, quantified, theme-tagged data — not raw text — with $0 ongoing
API cost at this project's scale.

---

## Phase 6 — Live website (dashboard + chat)

Build a Next.js app, deployed on Vercel, that:
- Reads directly from the `insights` table in Supabase and displays it
  as a dashboard: theme cards or bars, percentage breakdowns, sample
  quotes, sortable by mention count.
- Includes a simple chat panel that lets a visitor ask questions
  ("why don't users buy their wishlisted shoes?") answered by the
  Groq API using the current `insights` data as context.
- Auto-refreshes or re-fetches so it reflects new data after each daily
  pipeline run, with no redeploy needed.

**Acceptance criteria:** The website is live at a public Vercel URL,
shows real data from Supabase, and the chat panel gives a sensible
answer to a test question.

---

## Phase 7 — End-to-end verification

Before calling this done, verify the full loop actually works
end-to-end: trigger the GitHub Actions workflow manually, confirm new
raw rows appear, confirm new/updated insight rows appear after the
Claude step, and confirm the live website reflects the change without
any manual intervention from me. Use the browser agent to visually
check the deployed site renders correctly.

**Acceptance criteria:** One button click (manual workflow trigger)
results in updated data visible on the public website, with zero manual
steps from me in between.

---

## Phase 8 — Deliverable packaging

Once Phase 7 passes, prepare exactly what the assignment requires:
- The live, public website URL (the testable discovery engine link).
- A short written explanation of how the system works, suitable for a
  single presentation slide (data sources → Apify/direct scraping →
  Claude tagging → Supabase → live dashboard).
- A brief note on current limitations (e.g. keyword-based filtering may
  miss some phrasing, Apify free-tier run limits, sample size) so I can
  speak to them honestly if asked.
