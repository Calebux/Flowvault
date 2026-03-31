import { createPublicClient, http } from "viem";
import { mainnet } from "viem/chains";
import { normalize } from "viem/ens";
import { ENS_REGISTRY_ADDRESS } from "@flowvault/shared";

const ensClient = createPublicClient({
  chain: mainnet,
  transport: http(),
});

export async function resolveENSName(name: string): Promise<`0x${string}` | null> {
  try {
    const address = await ensClient.getEnsAddress({ name: normalize(name) });
    return address ?? null;
  } catch {
    return null;
  }
}

export async function getENSTextRecord(
  name: string,
  key: string
): Promise<string | null> {
  try {
    const text = await ensClient.getEnsText({ name: normalize(name), key });
    return text ?? null;
  } catch {
    return null;
  }
}

export interface AgentIdentity {
  ensName: string | null;
  selfVerified: boolean;
  operator: `0x${string}` | null;
  capabilities: string[];
}

export async function loadAgentIdentity(
  ensName: string
): Promise<AgentIdentity> {
  const [operator, capabilities, selfVerified] = await Promise.all([
    resolveENSName(ensName),
    getENSTextRecord(ensName, "agent.capabilities"),
    getENSTextRecord(ensName, "agent.selfVerified"),
  ]);

  return {
    ensName,
    selfVerified: selfVerified === "true",
    operator,
    capabilities: capabilities?.split(",") ?? [],
  };
}
