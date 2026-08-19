# Edge Cases & Corner Cases

This document outlines potential edge cases, corner cases, and failure modes for the AI-Powered Review and Conversation Discovery Engine, based on the current architecture (Apify, Groq, Supabase, Streamlit, Railway) and the problem statement.

## 1. Data Ingestion & Scraping (Apify)
*   **Anti-Bot & Structural Changes:** Social media platforms (like Reddit) or App Stores update their DOM structures or implement stricter CAPTCHAs, causing Apify scrapers to fail silently or return empty datasets.
*   **Viral Mention Spikes:** A Myntra campaign goes viral, resulting in 100x the normal volume of mentions. This could burn through Apify credits or cause timeout errors during scheduled scraping runs.
*   **Irrelevant Mentions:** Scrapers pick up content that mentions "Myntra" but has no relevance to purchase barriers (e.g., discussions about Myntra's corporate stock, job interviews at Myntra, or customer service complaints about a *past* delivery).
*   **Deleted Content:** Users delete their Reddit posts or YouTube comments between the time they are scraped and the time they are processed, leading to dead links if the PM tries to view the source.

## 2. Text Nuances & NLP Limitations
*   **Hinglish & Regional Slang:** A significant portion of Myntra's user base communicates in "Hinglish" (Hindi + English) or uses regional slang. The Groq LLM (e.g., Llama 3) might misinterpret or fail to extract intent from these sentences.
*   **Sarcasm:** A user writes, *"Great job Myntra, another dress that makes me look like a potato."* The LLM might flag "Great job" as positive sentiment if the prompt isn't robust against sarcasm.
*   **Multi-Product, Mixed-Sentiment Reviews:** A single comment says, *"The Nike shoes were a perfect fit, but the Puma jacket was way too tight so I didn't buy it."* The LLM must correctly attribute the purchase barrier (size/fit) only to the Puma jacket, not the Nike shoes.
*   **Vague Hesitation:** Users express hesitation without specifying the barrier: *"Added to wishlist but still thinking about it."* The LLM needs a fallback category (e.g., `Unspecified_Hesitation`) rather than forcing it into a known barrier bucket.

## 3. AI Processing & Pipeline (Groq)
*   **Context Window Overflow:** Extremely long Reddit rants or detailed comparison posts might exceed the token limit (context window) of the chosen Groq model, causing the API to truncate the text or throw an error.
*   **API Rate Limiting:** If the Apify scraper dumps 10,000 reviews at once, the Python processing script might hit Groq's Requests-Per-Minute (RPM) limits, causing the pipeline to crash mid-execution.
*   **LLM Hallucinations:** The LLM hallucinates a purchase barrier that isn't actually in the text, or extracts a brand name that wasn't mentioned (e.g., assuming a shoe is "Nike" just because it's a sneaker).

## 4. Storage & Database (Supabase Free Tier)
*   **Storage Exhaustion:** Supabase's free tier has a 500MB database limit. Scraping thousands of reviews weekly could quickly exhaust this limit, halting the entire pipeline.
*   **Connection Pooling Issues:** Streamlit apps, especially if multiple PMs use them simultaneously, might open too many database connections, exceeding Supabase's free tier connection limits and causing the dashboard to crash.

## 5. Serving & Presentation (Streamlit on Railway)
*   **Cold Starts:** Railway's free/hobby tier might spin down the Streamlit container after periods of inactivity. The first PM to access the dashboard in the morning might face a 30-60 second "cold start" delay.
*   **In-Memory Caching Limits:** If Streamlit caches large dataframes in memory (using `@st.cache_data`) to improve dashboard speed, it might exceed the RAM limits of the Railway container, leading to out-of-memory (OOM) crashes.
*   **Pagination/UI Lag:** If a PM tries to view "All Feedback" for a month, loading 50,000 rows into a Streamlit table component will freeze the browser. The UI must enforce strict pagination or limiting.
