import { createPublicClient, http } from "viem";
import { mainnet } from "viem/chains";
import { normalize } from "viem/ens";

const ensClient = createPublicClient({ chain: mainnet, transport: http() });

export async function resolveENS(name: string): Promise<`0x${string}` | null> {
  try {
    return await ensClient.getEnsAddress({ name: normalize(name) });
  } catch {
    return null;
  }
}

export async function getENSAvatar(name: string): Promise<string | null> {
  try {
    return await ensClient.getEnsAvatar({ name: normalize(name) });
  } catch {
    return null;
  }
}
