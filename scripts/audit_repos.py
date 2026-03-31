import json
import requests
import time
import re
from concurrent.futures import ThreadPoolExecutor

def get_raw_url(repo_url):
    if not repo_url or "github.com" not in repo_url:
        return None
    # Convert https://github.com/user/repo to https://raw.githubusercontent.com/user/repo/main/README.md
    base = repo_url.replace("github.com", "raw.githubusercontent.com")
    # Try common branches
    return [f"{base}/main/README.md", f"{base}/master/README.md", f"{base}/main/README.markdown", f"{base}/master/README.markdown"]

def audit_repo(project):
    repo_url = project.get("github")
    raw_urls = get_raw_url(repo_url)
    if not raw_urls:
        return {**project, "audit_status": "no_github"}
        
    readme_content = ""
    for url in raw_urls:
        try:
            res = requests.get(url, timeout=5)
            if res.status_code == 200:
                readme_content = res.text
                break
        except:
            continue
            
    if not readme_content:
        return {**project, "audit_status": "readme_not_found"}

    # Integrity Analysis
    PLACEHOLDERS = ["0x6e1ce3b44b", "0xYOUR_TX", "0xTX_HASH", "0xYOUR_ADDRESS", "0xYOUR_CONTRACT"]
    found_placeholders = [ph for ph in PLACEHOLDERS if ph.lower() in readme_content.lower()]
    
    # Tech Integration Analysis (Modern Stack)
    TECH_MARKERS = {
        "mento": ["mento-broker", "mento-sdk", "mento protocol", "usdm"],
        "x402": ["x402", "http-native payment"],
        "erc-8004": ["erc-8004", "agent-id", "identity-registry", "self protocol", "self-verified"],
        "filecoin": ["filecoin", "lighthouse", "bafy", "ipfs"],
        "agent_framework": ["eliza", "openclaw", "claude-code", "langchain", "autogen", "pydantic-ai"],
        "real_world": ["airtime", "utility bill", "remittance", "payment", "shopping", "defi", "yield", "savings", "trading", "bot", "telegram"],
        "complexity": ["sse", "streaming", "websocket", "autonomous", "24/7", "persistent"],
        "test_suite": ["pytest", "jest", "vitest", "hardhat test", "forge test"]
    }

    # Weighted Scoring (Official Synthesis Criteria)
    # 1. Technical Execution (40%)
    tech_score = 10 # Base for successful audit
    if any(m in readme_content.lower() for m in TECH_MARKERS["test_suite"]): tech_score += 10
    if any(m in readme_content.lower() for m in TECH_MARKERS["agent_framework"]): tech_score += 10
    if any(m in readme_content.lower() for m in TECH_MARKERS["complexity"]): tech_score += 10
    tech_score = min(tech_score, 40)

    # 2. Innovation (30%)
    # Using multiple modern protocols is a signal for innovation
    innovation_score = 0
    if any(m in readme_content.lower() for m in TECH_MARKERS["x402"]): innovation_score += 15
    if any(m in readme_content.lower() for m in TECH_MARKERS["mento"]): innovation_score += 15
    innovation_score = min(innovation_score, 30)

    # 3. Potential Impact (20%)
    impact_score = 0
    if any(m in readme_content.lower() for m in TECH_MARKERS["real_world"]): impact_score = 20

    # 4. Presentation (10%)
    # Quality of README and documentation
    pres_score = 5
    if len(readme_content) > 5000: pres_score += 5 # Detailed docs

    # 5. On-chain Artifacts / Rules (Bonus/Validation)
    has_onchain = any(m in readme_content.lower() for m in ["0x", "tx hash", "contract", "deployed", "erc-8004", "self protocol"])
    onchain_bonus = 5 if has_onchain else 0

    total_score = tech_score + innovation_score + impact_score + pres_score + onchain_bonus
    
    if found_placeholders: total_score -= 60 # Disqualification-level penalty
    if not repo_url: total_score -= 30

    return {
        **project,
        "audit_status": "success",
        "score": round(total_score, 1),
        "found_placeholders": found_placeholders,
        "breakdown": {
            "tech_execution": tech_score,
            "innovation": innovation_score,
            "impact": impact_score,
            "presentation": pres_score,
            "onchain": onchain_bonus
        },
        "readme_preview": readme_content[:200].replace("\n", " ")
    }

def run_audit():
    with open("filtered_projects.json", "r") as f:
        data = json.load(f)
        
    all_to_audit = data["celo"] + data["filecoin"]
    # De-duplicate by slug
    unique_projects = {p["slug"]: p for p in all_to_audit}.values()
    
    print(f"Auditing {len(unique_projects)} unique projects...")
    
    with ThreadPoolExecutor(max_workers=10) as executor:
        results = list(executor.map(audit_repo, unique_projects))
        
    return results

if __name__ == "__main__":
    results = run_audit()
    with open("audit_results.json", "w") as f:
        json.dump(results, f, indent=2)
        
    # Summary
    success = [r for r in results if r["audit_status"] == "success"]
    cheaters = [r for r in success if r["found_placeholders"]]
    
    print(f"Audit complete. Successfully audited {len(success)} READMEs.")
    print(f"Identified {len(cheaters)} projects with placeholder hashes.")
    
    for c in cheaters:
        print(f"CHEATER: {c['name']} ({c['slug']}) - Found: {c['found_placeholders']}")
