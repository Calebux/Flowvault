import { createConfig, http } from "wagmi";
import { celo, celoAlfajores } from "wagmi/chains";
import { getDefaultConfig } from "@rainbow-me/rainbowkit";

export const wagmiConfig = getDefaultConfig({
  appName: "MentoGuard",
  projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ?? "mentoguard-dev",
  chains: [celo, celoAlfajores],
  transports: {
    [celo.id]: http(process.env.NEXT_PUBLIC_CELO_RPC_URL ?? "https://forno.celo.org"),
    [celoAlfajores.id]: http("https://alfajores-forno.celo-testnet.org"),
  },
  ssr: true,
});
