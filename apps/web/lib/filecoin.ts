const LIGHTHOUSE_GATEWAY = "https://gateway.lighthouse.storage/ipfs";

export async function fetchFromFilecoin<T>(cid: string): Promise<T> {
  const res = await fetch(`${LIGHTHOUSE_GATEWAY}/${cid}`);
  if (!res.ok) throw new Error(`Lighthouse fetch failed: ${res.status}`);
  return res.json() as Promise<T>;
}

export function cidToGatewayUrl(cid: string): string {
  return `${LIGHTHOUSE_GATEWAY}/${cid}`;
}
