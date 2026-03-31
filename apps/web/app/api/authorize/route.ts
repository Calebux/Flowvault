import { NextResponse } from "next/server";
import Redis from "ioredis";

const redis = new Redis(process.env.REDIS_URL ?? "redis://localhost:6379");

export async function POST(req: Request) {
  try {
    const { smartAccount, signature, ensName, targetAllocation, driftThreshold, rules } = await req.json();

    if (!smartAccount || !signature) {
      return NextResponse.json({ error: "Missing smartAccount or signature" }, { status: 400 });
    }

    // Load any existing config (e.g. selfVerified set by Self Protocol)
    const existing = await redis.get("flowvault:user_config");
    const prev = existing ? JSON.parse(existing) : {};

    const config = {
      ...prev,
      smartAccount,
      ensName: ensName ?? prev.ensName ?? null,
      targetAllocation: targetAllocation ?? prev.targetAllocation,
      driftThreshold: driftThreshold ?? prev.driftThreshold,
      rules: rules ?? prev.rules,
      delegationSignature: signature,
      authorizedAt: Date.now(),
      telegramChatId: prev.telegramChatId ?? null,
      selfVerified: prev.selfVerified ?? false,
    };

    await redis.set("flowvault:user_config", JSON.stringify(config));

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[api/authorize]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
