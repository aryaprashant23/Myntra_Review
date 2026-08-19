import os
import json
import time
from collections import defaultdict, Counter
from dotenv import load_dotenv
from supabase import create_client, Client
from groq import Groq

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_ANON_KEY") or os.getenv("SUPABASE_SERVICE_ROLE_KEY")
GROQ_API_KEY = os.getenv("GROQ_API_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    raise ValueError("Missing Supabase credentials in .env")
if not GROQ_API_KEY:
    raise ValueError("Missing GROQ_API_KEY in .env")

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
groq_client = Groq(api_key=GROQ_API_KEY)

# Theme canonical mapping helper
DEFAULT_THEME_LABELS = {
    "fit_uncertainty": "Fit & Size Uncertainty",
    "price_wait": "Price Waiting & Discount Hesitation",
    "styling_doubt": "Styling & Outfit Pairing Doubt",
    "occasion_timing": "Occasion & Event Timing",
    "social_validation": "Social Validation & Review Skepticism",
    "delivery_return": "Delivery, Return & Convenience Doubts",
    "out_of_stock": "Availability & Size Stockout",
    "quality_concern": "Material & Fabric Quality Doubts"
}

SYSTEM_PROMPT = """You are an expert fashion e-commerce analyst studying why users add fashion items to their Myntra wishlist/cart but hesitate or do NOT complete the purchase.

Analyze the user's review or post.

Output ONLY valid JSON with the following structure:
{
  "is_relevant": true/false,
  "theme": "fit_uncertainty" | "price_wait" | "styling_doubt" | "occasion_timing" | "social_validation" | "delivery_return" | "quality_concern" | "other",
  "theme_label": "Human friendly title for the theme",
  "segment": "Apparel" | "Footwear" | "Accessories" | "Beauty" | "General",
  "key_quote": "Exact short snippet or sentence capturing why the user hesitated or held back",
  "reasoning": "Brief 1-sentence reason"
}

If the text is pure spam or completely unrelated to shopping/products/buying intent, set "is_relevant": false.
"""

import re

def get_best_available_model():
    """Detects available Groq chat models for this API key."""
    try:
        models = [m.id for m in groq_client.models.list().data]
        priority_list = [
            "openai/gpt-oss-120b",
            "openai/gpt-oss-20b",
            "qwen/qwen3.6-27b",
            "groq/compound-mini",
            "llama-3.3-70b-versatile",
            "llama-3.1-8b-instant"
        ]
        for candidate in priority_list:
            if candidate in models:
                return candidate
        chat_models = [m for m in models if "whisper" not in m and "guard" not in m]
        if chat_models:
            return chat_models[0]
    except Exception as e:
        print(f"Model list check notice: {e}")
    return "openai/gpt-oss-120b"

ACTIVE_MODEL = get_best_available_model()
print(f"Using Groq Model: {ACTIVE_MODEL}")

def extract_json(text):
    """Extracts JSON dictionary from response string."""
    try:
        return json.loads(text)
    except Exception:
        pass
    # Try finding JSON block between curly braces
    match = re.search(r'\{.*\}', text, re.DOTALL)
    if match:
        try:
            return json.loads(match.group(0))
        except Exception:
            pass
    return None

def analyze_review_with_groq(text, model=ACTIVE_MODEL, retries=3):
    """Sends review text to Groq API with retries and exponential backoff."""
    for attempt in range(retries):
        try:
            prompt_content = f"Analyze the following Myntra customer feedback and respond ONLY with a JSON object:\n\"\"\"{text}\"\"\""
            response = groq_client.chat.completions.create(
                model=model,
                messages=[
                    {"role": "system", "content": SYSTEM_PROMPT + "\nYou must format your entire response as a single valid JSON object."},
                    {"role": "user", "content": prompt_content}
                ],
                temperature=0.1,
                max_tokens=400
            )
            content = response.choices[0].message.content or ""
            parsed = extract_json(content)
            if parsed:
                return parsed
        except Exception as e:
            err_str = str(e)
            print(f"  [Attempt {attempt+1}] Groq API request notice: {err_str}", flush=True)
            if "429" in err_str or "rate limit" in err_str.lower():
                wait_time = (2 ** attempt) * 2
                print(f"  Rate limit encountered. Waiting {wait_time}s before retry...", flush=True)
                time.sleep(wait_time)
            elif "model_not_found" in err_str:
                model = "openai/gpt-oss-20b"
                time.sleep(1)
            else:
                time.sleep(1)
    return None

def main():
    print("=== Starting AI Normalization & Tagging Pipeline ===")
    
    # 1. Fetch all raw feedback rows
    print("Fetching records from raw_feedback table in Supabase...")
    res = supabase.table("raw_feedback").select("*").execute()
    raw_rows = res.data or []
    
    if not raw_rows:
        print("No rows found in raw_feedback. Run Phase 3 ingestion scripts first.")
        return
    
    print(f"Fetched {len(raw_rows)} raw reviews/posts for AI processing.")
    
    theme_data = defaultdict(lambda: {
        "theme_label": "",
        "mention_count": 0,
        "quotes": set(),
        "segments": Counter()
    })
    
    total_relevant = 0
    
    # 2. Process each item through Groq
    for idx, row in enumerate(raw_rows, 1):
        text = row.get("text", "").strip()
        if not text:
            continue
            
        print(f"[{idx}/{len(raw_rows)}] Normalizing via Groq ({row.get('platform')})...")
        analysis = analyze_review_with_groq(text)
        
        # Respect free-tier rate limits politely (small sleep)
        time.sleep(0.5)
        
        if not analysis:
            continue
            
        if analysis.get("is_relevant", True):
            total_relevant += 1
            theme = analysis.get("theme", "other").lower().replace(" ", "_")
            theme_label = analysis.get("theme_label") or DEFAULT_THEME_LABELS.get(theme, theme.replace("_", " ").title())
            key_quote = analysis.get("key_quote") or text[:120]
            segment = analysis.get("segment") or "General"
            
            theme_entry = theme_data[theme]
            theme_entry["theme_label"] = theme_label
            theme_entry["mention_count"] += 1
            if key_quote and len(key_quote) > 10:
                theme_entry["quotes"].add(key_quote.strip('" '))
            theme_entry["segments"][segment] += 1
    
    if total_relevant == 0:
        print("No relevant wishlist themes identified.")
        return
        
    print(f"\nProcessing complete! Found {total_relevant} relevant mentions across {len(theme_data)} themes.")
    
    # 3. Format aggregated insight records
    insights_to_upsert = []
    for theme, data in theme_data.items():
        mention_count = data["mention_count"]
        pct_of_total = round((mention_count / total_relevant) * 100, 1)
        
        # Format top 4 representative quotes
        sample_quotes = list(data["quotes"])[:4]
        
        # Format segment breakdown as percentage dictionary
        total_seg_mentions = sum(data["segments"].values()) or 1
        segment_breakdown = {
            seg: round((count / total_seg_mentions) * 100, 1)
            for seg, count in data["segments"].items()
        }
        
        insights_to_upsert.append({
            "theme": theme,
            "theme_label": data["theme_label"],
            "mention_count": mention_count,
            "pct_of_total": pct_of_total,
            "sample_quotes": sample_quotes,
            "segment_breakdown": segment_breakdown,
            "trend": "Trending" if pct_of_total > 20 else "Stable"
        })
    
    # Sort by mention count descending
    insights_to_upsert.sort(key=lambda x: x["mention_count"], reverse=True)
    
    print("\n--- Summary of Generated Insights ---")
    for ins in insights_to_upsert:
        print(f"• {ins['theme_label']}: {ins['mention_count']} mentions ({ins['pct_of_total']}%)")
    
    # 4. Upsert into Supabase insights table
    print("\nUpserting normalized themes into Supabase 'insights' table...")
    try:
        # Clear existing aggregated table for clean fresh aggregation
        supabase.table("insights").delete().neq("id", "00000000-0000-0000-0000-000000000000").execute()
        # Insert aggregated records
        supabase.table("insights").insert(insights_to_upsert).execute()
        print("Successfully updated Supabase 'insights' table!")
    except Exception as e:
        print(f"Error saving to insights table: {e}")

if __name__ == "__main__":
    main()
