import json

def filter_projects():
    with open("synthesis_projects_full.json", "r") as f:
        projects = json.load(f)
        
    celo_projects = []
    filecoin_projects = []
    
    # Common placeholder hashes
    PLACEHOLDERS = ["0x6e1ce3b44b", "0xYOUR_CUSD_TX_HASH", "0xTX_HASH"]
    
    CELO_SLUGS = ["best-agent-on-celo-ytzk5t", "autonomous-trading-agent-294kxt", "celo-track-f17h7o"]
    FILECOIN_SLUGS = ["pl-genesis-agents-with-receipts-8004", "best-use-case-with-agentic-storage-1bpa8z"]

    for p in projects:
        tracks = [t.get("slug", "").lower() for t in p.get("tracks", [])]
        
        is_celo = any(s in tracks for s in CELO_SLUGS)
        is_filecoin = any(s in tracks for s in FILECOIN_SLUGS)
        
        # Check for placeholders in tagline, description AND problem statement
        content = f"{p.get('tagline', '')} {p.get('description', '')} {p.get('problemStatement', '')}"
        has_placeholder = any(ph in content for ph in PLACEHOLDERS)
        
        project_info = {
            "name": p.get("name"),
            "slug": p.get("slug"),
            "github": p.get("repoURL"),
            "tagline": p.get("tagline"),
            "has_placeholder": has_placeholder,
            "tracks": tracks
        }
        
        if is_celo:
            celo_projects.append(project_info)
        if is_filecoin:
            filecoin_projects.append(project_info)
            
    return celo_projects, filecoin_projects

if __name__ == "__main__":
    celo, filecoin = filter_projects()
    
    with open("filtered_projects.json", "w") as f:
        json.dump({"celo": celo, "filecoin": filecoin}, f, indent=2)
        
    print(f"Celo projects: {len(celo)}")
    print(f"Filecoin projects: {len(filecoin)}")
    
    # Identify obvious cheaters
    celo_cheaters = [p for p in celo if p["has_placeholder"]]
    filecoin_cheaters = [p for p in filecoin if p["has_placeholder"]]
    
    print(f"Celo placeholders found: {len(celo_cheaters)}")
    print(f"Filecoin placeholders found: {len(filecoin_cheaters)}")
    
    for p in celo_cheaters + filecoin_cheaters:
        print(f"POTENTIAL DECEPTION: {p['name']} ({p['slug']}) - {p['tagline']}")
