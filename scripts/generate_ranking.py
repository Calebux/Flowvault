import json

def generate_ranking():
    with open("audit_results.json", "r") as f:
        results = json.load(f)
        
    with open("filtered_projects.json", "r") as f:
        filtered = json.load(f)
        
    celo_slugs = [p["slug"] for p in filtered["celo"]]
    filecoin_slugs = [p["slug"] for p in filtered["filecoin"]]
    
    # Map results by slug for easy lookup
    audit_map = {r["slug"]: r for r in results}
    
    def get_ranked_list(slugs):
        ranked = []
        for slug in slugs:
            if slug in audit_map:
                ranked.append(audit_map[slug])
        # Sort by score (desc), then name
        return sorted(ranked, key=lambda x: (-x.get("score", 0), x["name"]))

    celo_ranked = get_ranked_list(celo_slugs)
    filecoin_ranked = get_ranked_list(filecoin_slugs)
    
    return celo_ranked, filecoin_ranked

if __name__ == "__main__":
    celo, filecoin = generate_ranking()
    
    print("### TOP CELO PROJECTS ###")
    for i, p in enumerate(celo[:10]):
        print(f"{i+1}. {p['name']} (Score: {p.get('score', 0)}) - {p['slug']}")
        
    print("\n### TOP FILECOIN PROJECTS ###")
    for i, p in enumerate(filecoin[:10]):
        print(f"{i+1}. {p['name']} (Score: {p.get('score', 0)}) - {p['slug']}")
        
    # Save to a final report
    with open("final_audit_summary.json", "w") as f:
        json.dump({"celo": celo, "filecoin": filecoin}, f, indent=2)
