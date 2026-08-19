# System Architecture: AI-Powered Review and Conversation Discovery Engine

## Overview

The Discovery Engine is designed to collect, process, and analyze fragmented user feedback across various platforms (App Stores, Reddit, YouTube, Social Media, etc.) to uncover unresolved user problems that hinder wishlist-to-purchase conversions. The system employs natural language processing (NLP) and Large Language Models (LLMs) to categorize feedback and surface actionable insights.

## High-Level Architecture

```mermaid
graph TD
    subgraph Data Sources
        AS[App/Play Stores]
        RE[Reddit]
        SM[Social Media]
        YT[YouTube Comments]
        PR[Product Reviews]
    end

    subgraph Data Ingestion Layer
        S1[Apify Scrapers]
    end

    subgraph Processing & AI Layer
        DP[Data Cleaning & Deduplication]
        AI[Groq API / LLM Analysis]
        AI --> |Extracts| C1(Intent / Category)
        AI --> |Extracts| C2(Sentiment)
        AI --> |Extracts| C3(Product Entities)
        AI --> |Extracts| C4(Purchase Barriers)
    end

    subgraph Storage Layer
        DB[(Supabase / PostgreSQL DB)]
    end

    subgraph Serving & Presentation (Railway)
        ST[Streamlit Dashboard & UI]
    end

    AS --> S1
    RE --> S1
    SM --> S1
    YT --> S1
    PR --> S1

    S1 --> DP
    DP --> AI
    
    AI --> DB
    
    DB --> ST
```

## Component Details

### 1. Data Ingestion Layer (Apify)
Responsible for gathering data from multiple external sources efficiently, circumventing strict security policies.
- **Apify Scrapers:** Utilizing pre-built or custom Apify Actors to scrape Reddit, App Stores, and other platforms. This handles proxy rotation, captchas, and dynamic content rendering out-of-the-box.
- **Scheduler:** Apify's built-in scheduling to run scrapers at regular intervals.

### 2. Processing & AI Layer (Groq)
The core intelligence of the system where raw text is transformed into structured insights.
- **Data Cleaning:** A lightweight Python script to format scraped JSON, remove duplicates, and filter irrelevant content before sending to the LLM.
- **AI/LLM Analysis Engine (Groq API):** Utilizes Groq's ultra-fast inference API (e.g., using Llama 3 models) to perform:
  - **Categorization:** Classifying conversations into predefined buckets (e.g., Fit/Size, Price, Quality, Styling).
  - **Intent Detection:** Identifying if the user is comparing products, seeking validation, or expressing abandonment reasons.
  - **Entity Extraction:** Identifying specific brands, product IDs, or clothing types mentioned.

### 3. Storage Layer (Supabase/PostgreSQL)
**Do we need a database? Yes.** While Streamlit can run without a database, you need persistent storage so you don't have to re-scrape Apify and re-query Groq on every page load (which would hit rate limits and incur costs).
- **Relational Database:** A free-tier PostgreSQL database like **Supabase** or **Neon** to store:
  - Raw scraped text (for audits).
  - Processed AI insights (categories, sentiment, identified barriers).
- *Optional Vector DB:* Supabase supports `pgvector` out of the box if you want to add semantic search capabilities later for free.

### 4. Serving & Presentation Layer (Streamlit on Railway)
Delivers insights to the end-users (Product Managers).
- **Hosting (Railway):** Railway is used to host the Streamlit application and any background Python workers for data processing.
- **Frontend/Dashboard (Streamlit):** A Python-based interactive web application allowing Product Managers to:
  - View overall trends in purchase barriers via charts and metrics.
  - Drill down into specific product categories or user segments.
  - Explore the stored data queried directly from Supabase.
