// Self Protocol integration
// Docs: https://docs.self.xyz

export interface SelfVerificationPayload {
  proof: unknown;
  publicSignals: unknown;
}

export async function verifySelfProof(
  payload: SelfVerificationPayload
): Promise<boolean> {
  const res = await fetch("/api/self/verify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = (await res.json()) as { verified: boolean };
  return data.verified;
}
