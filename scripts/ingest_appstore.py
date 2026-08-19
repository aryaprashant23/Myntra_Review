import os
import requests
from dotenv import load_dotenv
from supabase import create_client, Client
from apify_client import ApifyClient

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_ANON_KEY") or os.getenv("SUPABASE_SERVICE_ROLE_KEY")
APIFY_API_TOKEN = os.getenv("APIFY_API_TOKEN")

if not SUPABASE_URL or not SUPABASE_KEY:
    raise ValueError("Missing Supabase credentials in .env")

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

def fetch_via_apple_rss(app_id="907394059", country="in"):
    """Fetches public App Store reviews directly via Apple iTunes RSS endpoint."""
    print("Fetching App Store reviews via Apple RSS...")
    url = f"https://itunes.apple.com/{country}/rss/customerreviews/id={app_id}/sortBy=mostRecent/json"
    response = requests.get(url, timeout=30)
    if response.status_code != 200:
        print(f"Apple RSS returned status code {response.status_code}")
        return []
    
    data = response.json()
    entries = data.get("feed", {}).get("entry", [])
    reviews_list = []
    
    # First entry in RSS is often app info metadata, skip if no author/rating
    for entry in entries:
        if not isinstance(entry, dict):
            continue
        review_text = entry.get("content", {}).get("label") or entry.get("title", {}).get("label") or ""
        review_id = entry.get("id", {}).get("label") or str(hash(review_text))
        author = entry.get("author", {}).get("name", {}).get("label") or "Anonymous"
        rating_str = entry.get("im:rating", {}).get("label")
        rating = int(rating_str) if rating_str and rating_str.isdigit() else None
        
        reviews_list.append({
            "id": review_id,
            "text": review_text,
            "author": author,
            "rating": rating,
            "url": f"https://apps.apple.com/{country}/app/id{app_id}"
        })
    return reviews_list

def main():
    rows_to_insert = []
    
    # 1. Try Apify if configured
    if APIFY_API_TOKEN:
        try:
            print("Attempting to trigger Apify App Store Reviews Scraper...")
            apify_client = ApifyClient(APIFY_API_TOKEN)
            actor_id = "the-wolves/app-store-reviews-scraper"
            run_input = {
                "appUrls": ["https://apps.apple.com/in/app/myntra-fashion-shopping-app/id907394059"],
                "country": "in",
                "maxItems": 100
            }
            run = apify_client.actor(actor_id).call(run_input=run_input)
            dataset_id = getattr(run, 'default_dataset_id', None) or getattr(run, 'defaultDatasetId', None)
            dataset_items = apify_client.dataset(dataset_id).iterate_items()
            
            for item in dataset_items:
                text = item.get('text') or item.get('review') or item.get('body') or ""
                matched_kw = keyword_match(text)
                if matched_kw:
                    item_id = item.get('id') or item.get('reviewId') or str(hash(text))
                    rows_to_insert.append({
                        "external_id": f"appstore_{item_id}",
                        "platform": "appstore",
                        "text": text,
                        "url": item.get('url') or "https://apps.apple.com/in/app/id907394059",
                        "author": item.get('userName') or item.get('author') or "Anonymous",
                        "rating": item.get('score') or item.get('rating'),
                        "keyword_matched": matched_kw,
                    })
        except Exception as e:
            print(f"Apify actor error: {e}. Falling back to direct Apple iTunes RSS feed...")

    # 2. If no rows from Apify or Apify failed, fetch via Apple RSS
    if not rows_to_insert:
        rss_reviews = fetch_via_apple_rss(app_id="907394059", country="in")
        for item in rss_reviews:
            matched_kw = keyword_match(item["text"])
            if matched_kw:
                rows_to_insert.append({
                    "external_id": f"appstore_{item['id']}",
                    "platform": "appstore",
                    "text": item["text"],
                    "url": item["url"],
                    "author": item["author"],
                    "rating": item["rating"],
                    "keyword_matched": matched_kw,
                })

    unique_rows = {r['external_id']: r for r in rows_to_insert}.values()
    rows_to_insert = list(unique_rows)

    if rows_to_insert:
        print(f"Found {len(rows_to_insert)} matching App Store reviews. Upserting to Supabase...")
        try:
            supabase.table('raw_feedback').upsert(rows_to_insert, on_conflict='external_id').execute()
            print("Upserted App Store reviews successfully.")
        except Exception as e:
            print(f"Error upserting to Supabase: {e}")
    else:
        print("No matching App Store data found with wishlist keywords.")

if __name__ == "__main__":
    main()
