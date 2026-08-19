-- Table 1: raw_feedback
-- Stores every scraped review, post, or comment before cleaning.
CREATE TABLE raw_feedback (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    external_id TEXT UNIQUE NOT NULL,
    platform TEXT NOT NULL CHECK (platform IN ('playstore', 'reddit', 'appstore')),
    text TEXT NOT NULL,
    url TEXT,
    author TEXT,
    rating INTEGER,
    keyword_matched TEXT,
    scraped_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table 2: insights
-- Stores the cleaned, tagged output that the website will display.
CREATE TABLE insights (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    theme TEXT NOT NULL,
    theme_label TEXT NOT NULL,
    mention_count INTEGER DEFAULT 0,
    pct_of_total NUMERIC DEFAULT 0,
    sample_quotes TEXT[] DEFAULT '{}',
    segment_breakdown JSONB DEFAULT '{}'::jsonb,
    trend TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
