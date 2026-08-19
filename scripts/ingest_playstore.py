import os
import datetime
from dotenv import load_dotenv
from supabase import create_client, Client
from google_play_scraper import reviews, Sort

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_ANON_KEY") or os.getenv("SUPABASE_SERVICE_ROLE_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    raise ValueError("Missing Supabase credentials in .env file")

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

KEYWORDS = [
    "wishlist", "wish list", "save for later", "saved item", 
    "bookmark", "cart", "buy later", "shortlist"
]

def keyword_match(text):
    if not text:
        return None
    text_lower = text.lower()
    for kw in KEYWORDS:
        if kw in text_lower:
            return kw
    return None

def main():
    print("Fetching Play Store reviews...")
    rows_to_insert = []
    
    # Fetch newest reviews
    result_newest, _ = reviews(
        'com.myntra.android',
        lang='en',
        country='in',
        sort=Sort.NEWEST,
        count=1000
    )
    
    # Fetch most relevant reviews
    result_relevant, _ = reviews(
        'com.myntra.android',
        lang='en',
        country='in',
        sort=Sort.MOST_RELEVANT,
        count=1000
    )
    all_reviews = result_newest + result_relevant
    for review in all_reviews:
        matched_kw = keyword_match(review['content'])
        if matched_kw:
            rows_to_insert.append({
                "external_id": f"playstore_{review['reviewId']}",
                "platform": "playstore",
                "text": review['content'],
                "url": f"https://play.google.com/store/apps/details?id=com.myntra.android&reviewId={review['reviewId']}",
                "author": review['userName'],
                "rating": review['score'],
                "keyword_matched": matched_kw,
            })
    
    # Deduplicate by external_id
    unique_rows = {r['external_id']: r for r in rows_to_insert}.values()
    rows_to_insert = list(unique_rows)
    
    if rows_to_insert:
        print(f"Found {len(rows_to_insert)} reviews matching keywords. Upserting to Supabase...")
        try:
            response = supabase.table('raw_feedback').upsert(rows_to_insert, on_conflict='external_id').execute()
            print(f"Upserted successfully.")
        except Exception as e:
            print(f"Error upserting to Supabase: {e}")
    else:
        print("No matching Play Store reviews found.")

if __name__ == "__main__":
    main()
