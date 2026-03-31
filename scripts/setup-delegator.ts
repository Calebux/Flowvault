/**
 * MentoGuard — DeleGator Setup Script
 *
 * Two modes:
 *   1. --testnet   Use Base Sepolia (supported by toolkit) to get env values for dev
 *   2. --deploy    Deploy DeleGator contracts to Celo mainnet (needs funded wallet)
 *
 * Usage:
 *   pnpm tsx scripts/setup-delegator.ts --testnet
 *   pnpm tsx scripts/setup-delegator.ts --deploy
 */

import { createPublicClient, createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { celo, baseSepolia } from "viem/chains";
import {
  toMetaMaskSmartAccount,
  getDeleGatorEnvironment,
  deployDeleGatorEnvironment,
  overrideDeployedEnvironment,
  Implementation,
  PREFERRED_VERSION,
} from "@metamask/delegation-toolkit";

const DELEGATION_KEY = process.env.MM_DELEGATION_KEY;
const CELO_RPC = process.env.CELO_RPC_URL ?? "https://forno.celo.org";

const mode = process.argv[2];

if (!DELEGATION_KEY) {
  console.error("❌  MM_DELEGATION_KEY is not set.\n");
  console.error("    Run: MM_DELEGATION_KEY=0x... pnpm tsx scripts/setup-delegator.ts --testnet");
  process.exit(1);
}

if (!mode || (mode !== "--testnet" && mode !== "--deploy")) {
  console.log("Usage:");
  console.log("  pnpm tsx scripts/setup-delegator.ts --testnet   # Dev: use Base Sepolia");
  console.log("  pnpm tsx scripts/setup-delegator.ts --deploy    # Prod: deploy to Celo mainnet");
  process.exit(0);
}

async function runTestnet() {
  console.log("🔧  MentoGuard — DeleGator Setup (Base Sepolia testnet)\n");
  console.log("ℹ️   Celo mainnet is not yet supported by the toolkit.");
  console.log("    Using Base Sepolia (84532) to get valid env values for development.\n");

  const owner = privateKeyToAccount(DELEGATION_KEY as `0x${string}`);

  const client = createPublicClient({
    chain: baseSepolia,
    transport: http(),
  });

  const environment = getDeleGatorEnvironment(baseSepolia.id);

  const smartAccount = await toMetaMaskSmartAccount({
    client,
    implementation: Implementation.Hybrid,
    deployParams: [owner.address, [], [], []],
    deploySalt: "0x",
    environment,
    signer: { account: owner },
  });

  console.log("✅  Results — copy these into your .env:\n");
  console.log(`CELO_SMART_ACCOUNT_ADDRESS=${smartAccount.address}   # ⚠️  Base Sepolia address — will differ on Celo`);
  console.log(`MM_DELEGATION_CONTRACT=${environment.DelegationManager}`);
  console.log("\n📋  Full environment:");
  console.log("  DelegationManager:", environment.DelegationManager);
  console.log("  EntryPoint:       ", environment.EntryPoint);
  console.log("  SimpleFactory:    ", environment.SimpleFactory);
  console.log("\n⚠️   These addresses are for Base Sepolia. Run --deploy once you're ready for Celo mainnet.");
}

async function runDeploy() {
  console.log("🚀  MentoGuard — DeleGator Deployment to Celo Mainnet\n");
  console.log("⚠️   This will deploy multiple contracts and spend CELO for gas.\n");

  const deployer = privateKeyToAccount(DELEGATION_KEY as `0x${string}`);
  console.log("Deployer:", deployer.address);

  const publicClient = createPublicClient({
    chain: celo,
    transport: http(CELO_RPC),
  });

  const balance = await publicClient.getBalance({ address: deployer.address });
  const balanceCelo = Number(balance) / 1e18;
  console.log(`Balance: ${balanceCelo.toFixed(4)} CELO\n`);

  if (balanceCelo < 0.1) {
    console.error("❌  Insufficient balance. Need at least 0.1 CELO to deploy contracts.");
    console.error("    Fund this address first:", deployer.address);
    process.exit(1);
  }

  const walletClient = createWalletClient({
    chain: celo,
    transport: http(CELO_RPC),
    account: deployer,
  });

  console.log("Deploying DeleGator environment to Celo... this may take a minute.\n");

  const environment = await deployDeleGatorEnvironment({
    publicClient,
    walletClient,
    version: PREFERRED_VERSION,
  });

  // Register the deployed environment so the toolkit recognizes it
  overrideDeployedEnvironment(celo.id, PREFERRED_VERSION, environment);

  const smartAccount = await toMetaMaskSmartAccount({
    client: publicClient,
    implementation: Implementation.Hybrid,
    deployParams: [deployer.address, [], [], []],
    deploySalt: "0x",
    environment,
    signer: { account: deployer },
  });

  console.log("✅  Deployment complete! Copy these into your .env:\n");
  console.log(`CELO_SMART_ACCOUNT_ADDRESS=${smartAccount.address}`);
  console.log(`MM_DELEGATION_CONTRACT=${environment.DelegationManager}`);
  console.log("\n📋  Full deployed environment:");
  console.log("  DelegationManager:", environment.DelegationManager);
  console.log("  EntryPoint:       ", environment.EntryPoint);
  console.log("  SimpleFactory:    ", environment.SimpleFactory);
  console.log("\n💾  Save the full environment object for your records — you'll need it to override in production code.");
  console.log(JSON.stringify(environment, null, 2));
}

if (mode === "--testnet") {
  runTestnet().catch((err) => { console.error("❌", err.message ?? err); process.exit(1); });
} else {
  runDeploy().catch((err) => { console.error("❌", err.message ?? err); process.exit(1); });
}
