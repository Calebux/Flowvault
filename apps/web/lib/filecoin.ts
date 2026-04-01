const LIGHTHOUSE_GATEWAY = "https://gateway.lighthouse.storage/ipfs";
const LIGHTHOUSE_UPLOAD  = "https://node.lighthouse.storage/api/v0/add";

export async function fetchFromFilecoin<T>(cid: string): Promise<T> {
  const res = await fetch(`${LIGHTHOUSE_GATEWAY}/${cid}`);
  if (!res.ok) throw new Error(`Lighthouse fetch failed: ${res.status}`);
  return res.json() as Promise<T>;
}

export function cidToGatewayUrl(cid: string): string {
  return `${LIGHTHOUSE_GATEWAY}/${cid}`;
}

/**
 * Upload a JSON object to Filecoin via Lighthouse.
 * Returns the IPFS CID — permanently accessible at:
 *   https://gateway.lighthouse.storage/ipfs/<cid>
 */
export async function uploadToLighthouse(data: unknown): Promise<string | null> {
  const apiKey = process.env.LIGHTHOUSE_API_KEY;
  if (!apiKey) return null;
  try {
    const json = JSON.stringify(data, null, 2);
    const form = new FormData();
    form.append("file", new Blob([json], { type: "application/json" }), "decision.json");
    const res = await fetch(LIGHTHOUSE_UPLOAD, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form,
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return null;
    const result = await res.json() as { Hash?: string };
    return result.Hash ?? null;
  } catch {
    return null;
  }
}
