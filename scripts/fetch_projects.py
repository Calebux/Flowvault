import requests
import json
import time

BASE_URL = "https://synthesis.devfolio.co/projects"
PAGE_LIMIT = 20 # The API seems to use 20 by default

def fetch_all_projects():
    all_projects = []
    page = 1
    headers = {
        "Accept": "application/json",
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    }
    
    while True:
        print(f"Fetching page {page}...")
        response = requests.get(f"{BASE_URL}?page={page}", headers=headers)
        if response.status_code != 200:
            print(f"Error fetching page {page}: {response.status_code}")
            break
            
        data = response.json()
        projects = data.get("data", [])
        if not projects:
            print(f"No projects found on page {page}. Keys: {list(data.keys())}")
            break
            
        all_projects.extend(projects)
        
        if page >= data.get("pagination", {}).get("totalPages", 1):
            break
            
        page += 1
        time.sleep(1) # Be nice to the API
        
    return all_projects

if __name__ == "__main__":
    all_projects = fetch_all_projects()
    with open("synthesis_projects_full.json", "w") as f:
        json.dump(all_projects, f, indent=2)
    print(f"Done! Saved {len(all_projects)} projects to synthesis_projects_full.json")
