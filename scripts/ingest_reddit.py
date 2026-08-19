import os
from dotenv import load_dotenv
from supabase import create_client, Client
from apify_client import ApifyClient

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_ANON_KEY") or os.getenv("SUPABASE_SERVICE_ROLE_KEY")
APIFY_API_TOKEN = os.getenv("APIFY_API_TOKEN")

if not SUPABASE_URL or not SUPABASE_KEY:
    raise ValueError("Missing Supabase credentials in .env")
if not APIFY_API_TOKEN:
    raise ValueError("Missing Apify API token in .env")

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
apify_client = ApifyClient(APIFY_API_TOKEN)

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
    print("Triggering Apify Reddit Scraper...")
    
    run_input = {
        "searches": [
            "myntra wishlist", 
            "myntra cart", 
            "myntra save for later"
        ],
        "searchQueries": [
            "myntra wishlist", 
            "myntra cart", 
            "myntra save for later"
        ],
        "type": "search",
        "sort": "new",
        "time": "year",
        "maxItems": 100
    }
    
    actor_id = "trudax/reddit-scraper-lite" 
    
    try:
        run = apify_client.actor(actor_id).call(run_input=run_input)
    except Exception as e:
        print(f"Failed to run Apify actor: {e}")
        return

    print("Apify run finished. Fetching dataset...")
    dataset_id = getattr(run, 'default_dataset_id', None) or getattr(run, 'defaultDatasetId', None) or (run.get('defaultDatasetId') if isinstance(run, dict) else getattr(run, 'id', None))
    dataset_items = apify_client.dataset(dataset_id).iterate_items()
    
    rows_to_insert = []
    for item in dataset_items:
        text = item.get('body') or item.get('title') or item.get('selftext') or item.get('text') or ""
        matched_kw = keyword_match(text)
        
        if matched_kw:
            item_id = item.get('id') or (item.get('url', '').split('/')[-2] if item.get('url') else None) or str(hash(text))
            rows_to_insert.append({
                "external_id": f"reddit_{item_id}",
                "platform": "reddit",
                "text": text,
                "url": item.get('url'),
                "author": item.get('author') or item.get('authorName') or "Anonymous",
                "rating": None,
                "keyword_matched": matched_kw,
            })

    unique_rows = {r['external_id']: r for r in rows_to_insert}.values()
    rows_to_insert = list(unique_rows)

    if rows_to_insert:
        print(f"Found {len(rows_to_insert)} matching Reddit posts. Upserting...")
        try:
            supabase.table('raw_feedback').upsert(rows_to_insert, on_conflict='external_id').execute()
            print("Upserted successfully.")
        except Exception as e:
            print(f"Error upserting: {e}")
    else:
        print("No matching Reddit data found.")

if __name__ == "__main__":
    main()
