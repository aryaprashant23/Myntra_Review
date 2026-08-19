# Deployment Plan: Myntra Wishlist-to-Purchase Conversion Intelligence Engine

This document outlines the step-by-step deployment process for the Myntra Wishlist-to-Purchase Conversion Intelligence Engine. The system relies on 100% free-tier infrastructure across Supabase, Apify, Groq, GitHub Actions, and Vercel.

## Prerequisites

Before starting the deployment, ensure you have created free accounts on the following platforms:
1. [GitHub](https://github.com/) - For code repository and CI/CD automation (GitHub Actions).
2. [Supabase](https://supabase.com/) - For the PostgreSQL database.
3. [Apify](https://apify.com/) - For Reddit and App Store scraping actors.
4. [Groq](https://console.groq.com/) - For the high-speed Llama LLM API.
5. [Vercel](https://vercel.com/) - For hosting the Next.js frontend and API routes.

---

## 1. Database Setup (Supabase)

1. Create a new project in your Supabase account.
2. Navigate to the SQL Editor and execute the following queries to create the necessary tables:

```sql
-- Table for raw scraped feedback
CREATE TABLE raw_feedback (
    id SERIAL PRIMARY KEY,
    external_id TEXT UNIQUE NOT NULL,
    platform TEXT NOT NULL,
    text TEXT NOT NULL,
    url TEXT,
    author TEXT,
    rating INTEGER,
    keyword_matched TEXT,
    scraped_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table for AI-processed insights
CREATE TABLE insights (
    id SERIAL PRIMARY KEY,
    theme TEXT NOT NULL,
    theme_label TEXT NOT NULL,
    mention_count INTEGER DEFAULT 0,
    pct_of_total NUMERIC,
    sample_quotes TEXT[],
    segment_breakdown JSONB,
    trend TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

3. Retrieve your **Project URL** and **anon public key** from the Supabase Project Settings (API section). Keep these handy for later steps.

---

## 2. Scraper Configuration (Apify)

1. Log in to your Apify console.
2. Ensure you have access to the actors needed:
   - Reddit Scraper: `trudax/reddit-scraper-lite`
   - App Store Reviews Scraper: `epctex/appstore-scraper`
3. Retrieve your **Apify API Token** from Settings > Integrations.

---

## 3. AI Inference Setup (Groq)

1. Log in to the Groq Cloud Console.
2. Generate a new API Key.
3. Retrieve the **Groq API Key** (ensure to keep this secure).

---

## 4. Automation Setup (GitHub Actions)

1. Push your project code to a public GitHub repository.
2. In the repository, go to **Settings** > **Secrets and variables** > **Actions**.
3. Add the following **Repository Secrets**:
   - `SUPABASE_URL`: Your Supabase Project URL.
   - `SUPABASE_ANON_KEY`: Your Supabase API Key.
   - `APIFY_API_TOKEN`: Your Apify API Token.
   - `GROQ_API_KEY`: Your Groq API Key.
4. The workflow file `.github/workflows/ingest.yml` is already configured to run daily at `03:00 UTC` and can also be triggered manually.
5. Test the ingestion pipeline by manually triggering the workflow from the **Actions** tab. Verify that data populates the `raw_feedback` and `insights` tables in Supabase.

---

## 5. Frontend Deployment (Vercel)

1. Log in to Vercel and click **Add New Project**.
2. Import the GitHub repository for this project.
3. In the project configuration, under **Environment Variables**, add the following keys:
   - `NEXT_PUBLIC_SUPABASE_URL`: Your Supabase Project URL.
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Your Supabase API Key.
   - `GROQ_API_KEY`: Your Groq API Key (required for the `/api/chat` serverless route).
4. Deploy the project. Vercel will automatically build the Next.js app and assign a public URL.

---

## 6. End-to-End Verification

1. Go to the public URL provided by Vercel and verify the dashboard loads successfully.
2. Trigger the GitHub Actions workflow manually.
3. Once the workflow completes, check the Supabase `raw_feedback` and `insights` tables for new records.
4. Refresh the Vercel app (or wait for auto-refresh) to ensure the newly processed data is reflected on the live dashboard.
5. Use the embedded Wishlist AI Copilot chat panel to ask a question (e.g., "Why do users add items to their wishlist but don't buy them?") and verify it responds using the live Supabase context.
